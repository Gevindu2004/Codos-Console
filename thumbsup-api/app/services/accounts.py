"""Account emails sent by ThumbsUp itself: verification codes and password resets."""

import hashlib
import hmac
import html
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import ApiError
from app.models import AuthCode, User, new_id
from app.services import providers

MAX_CODE_ATTEMPTS = 5


def _hash(code: str) -> str:
    return hmac.new(settings.JWT_SECRET.encode(), code.encode(), hashlib.sha256).hexdigest()


def issue_code(db: Session, user: User, purpose: str) -> str:
    # Only the newest code works
    db.execute(
        update(AuthCode)
        .where(AuthCode.user_id == user.id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None))
        .values(used_at=datetime.now(timezone.utc))
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        AuthCode(
            user_id=user.id,
            purpose=purpose,
            code_hash=_hash(code),
            attempts=0,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.CODE_TTL_MINUTES),
        )
    )
    db.commit()
    return code


def check_code(db: Session, user: User, purpose: str, code: str) -> None:
    row = db.scalar(
        select(AuthCode)
        .where(AuthCode.user_id == user.id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None))
        .order_by(AuthCode.created_at.desc())
    )
    wrong = ApiError(400, "invalid_code", "That code is wrong or has expired. Request a new code and try again.")
    if not row:
        raise wrong
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc) or row.attempts >= MAX_CODE_ATTEMPTS:
        raise wrong
    row.attempts += 1
    if not hmac.compare_digest(row.code_hash, _hash(code.strip().replace(" ", ""))):
        db.commit()
        raise wrong
    row.used_at = datetime.now(timezone.utc)
    db.commit()


def send_code_email(user: User, code: str, purpose: str) -> None:
    if purpose == "verify":
        subject = f"{code} is your ThumbsUp Email verification code"
        intro = "Welcome to ThumbsUp Email! Use this code to verify your email address:"
    else:
        subject = f"{code} is your ThumbsUp Email password reset code"
        intro = "Someone (hopefully you) asked to reset your ThumbsUp Email password. Use this code:"
    minutes = settings.CODE_TTL_MINUTES
    text = f"Hi {user.name},\n\n{intro}\n\n    {code}\n\nThe code expires in {minutes} minutes. If you didn't ask for it, you can ignore this email."
    body = (
        '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">'
        f"<p>Hi {html.escape(user.name)},</p><p>{intro}</p>"
        f'<div style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f1f5f9;border-radius:12px;'
        f'padding:16px;text-align:center">{code}</div>'
        f'<p style="color:#64748b">The code expires in {minutes} minutes. If you didn\'t ask for it, you can ignore this email.</p></div>'
    )
    mime = providers.build_mime(
        from_email=settings.DEFAULT_FROM_EMAIL,
        from_name=settings.DEFAULT_FROM_NAME,
        to=[user.email],
        cc=[],
        reply_to=None,
        subject=subject,
        html=body,
        text=text,
        attachments=[],
        message_id=new_id("sys"),
    )
    try:
        providers.send(mime, [user.email])
    except (providers.ProviderError, providers.PartialDelivery) as exc:
        raise ApiError(502, "email_not_sent", f"We couldn't send the code email: {exc}") from exc
