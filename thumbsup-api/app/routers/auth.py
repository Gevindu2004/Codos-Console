from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import ApiError, client_ip, enforce_rate, get_current_user
from app.models import User
from app.security import DUMMY_PASSWORD_HASH, create_session_token, hash_password, rate_limiter, verify_password
from app.services import accounts
from app.services.delivery import clean_email

router = APIRouter(prefix="/dashboard/auth", tags=["Dashboard: account"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=320)
    password: str = Field(max_length=200)
    company: str = Field(default="", max_length=160)


class CodeIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class ForgotIn(BaseModel):
    email: str = Field(max_length=320)


class ResetIn(BaseModel):
    email: str = Field(max_length=320)
    code: str = Field(min_length=4, max_length=12)
    password: str = Field(max_length=200)


class LoginIn(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=200)


def user_view(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "company": u.company,
        "plan": u.plan,
        "email_verified": u.email_verified,
        "created_at": u.created_at,
    }


def _set_session(response: Response, user: User) -> None:
    response.set_cookie(
        settings.COOKIE_NAME,
        create_session_token(user.id, user.session_version or 0),
        max_age=settings.SESSION_HOURS * 3600,
        httponly=True,  # JavaScript can't read it, so XSS can't steal the session
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def _check_password_strength(password: str) -> None:
    if len(password) < 8:
        raise ApiError(422, "weak_password", "Use at least 8 characters for your password.")
    if password.isdigit() or password.isalpha():
        raise ApiError(422, "weak_password", "Mix letters and numbers in your password.")


@router.post("/register", status_code=201)
def register(
    body: RegisterIn, request: Request, response: Response, background: BackgroundTasks, db: Session = Depends(get_db)
):
    enforce_rate(f"register:{client_ip(request)}", settings.LOGIN_RATE_PER_MINUTE, "sign-up attempts")
    email = clean_email(body.email, "email").lower()
    _check_password_strength(body.password)
    if db.scalar(select(User).where(User.email == email)):
        raise ApiError(409, "email_taken", "An account with this email already exists. Try logging in.")
    user = User(email=email, name=body.name.strip(), company=body.company.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    _set_session(response, user)
    code = accounts.issue_code(db, user, "verify")
    background.add_task(_send_quietly, user, code)  # don't make sign-up wait for the mail server
    return {"user": user_view(user)}


def _send_quietly(user: User, code: str) -> None:
    try:
        accounts.send_code_email(user, code, "verify")
    except ApiError:
        pass  # the user can press "Resend code" in the dashboard


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce_rate(f"login:{client_ip(request)}", settings.LOGIN_RATE_PER_MINUTE, "login attempts")
    email = body.email.strip().lower()
    # Per-account lock: stops password guessing spread over many IPs
    failures, wait = rate_limiter.count(f"loginfail:{email}", 900)
    if failures >= settings.LOGIN_FAILURES_PER_ACCOUNT:
        raise ApiError(429, "account_locked",
                       f"Too many wrong passwords for this account. Try again in {max(1, wait // 60)} minutes, "
                       "or reset your password.", headers={"Retry-After": str(wait)})
    user = db.scalar(select(User).where(User.email == email))
    # Same work and same message whether or not the email exists (no account guessing)
    ok = verify_password(body.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if not user or not ok:
        rate_limiter.allow(f"loginfail:{email}", 10**6, 900)
        raise ApiError(401, "wrong_credentials", "Email or password is incorrect.")
    _set_session(response, user)
    return {"user": user_view(user)}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Logs out on every device: older login tokens stop working."""
    try:
        user = get_current_user(request, db)
        user.session_version = (user.session_version or 0) + 1
        db.commit()
    except ApiError:
        pass
    response.delete_cookie(settings.COOKIE_NAME, path="/")
    return {"ok": True}


@router.post("/verify/resend")
def resend_verification(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.email_verified:
        return {"ok": True, "already_verified": True}
    enforce_rate(f"code:{user.id}", 3, "code requests")
    accounts.send_code_email(user, accounts.issue_code(db, user, "verify"), "verify")
    return {"ok": True}


@router.post("/verify")
def verify_email(body: CodeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.email_verified:
        accounts.check_code(db, user, "verify", body.code)
        user.email_verified = True
        db.commit()
    return {"user": user_view(user)}


@router.post("/password/forgot")
def forgot_password(body: ForgotIn, request: Request, db: Session = Depends(get_db)):
    enforce_rate(f"forgot:{client_ip(request)}", 5, "reset requests")
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user:
        accounts.send_code_email(user, accounts.issue_code(db, user, "reset"), "reset")
    # Same answer either way, so nobody can find out which emails have accounts
    return {"ok": True, "message": "If an account exists for that email, we've sent a reset code."}


@router.post("/password/reset")
def reset_password(body: ResetIn, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce_rate(f"reset:{client_ip(request)}", settings.LOGIN_RATE_PER_MINUTE, "reset attempts")
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user:
        raise ApiError(400, "invalid_code", "That code is wrong or has expired. Request a new code and try again.")
    _check_password_strength(body.password)
    accounts.check_code(db, user, "reset", body.code)
    user.password_hash = hash_password(body.password)
    user.email_verified = True  # they proved they own the inbox
    user.session_version = (user.session_version or 0) + 1  # sign out every other device
    db.commit()
    rate_limiter.clear(f"loginfail:{user.email}")
    _set_session(response, user)
    return {"user": user_view(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"user": user_view(user)}
