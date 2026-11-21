"""Shared request helpers: errors, who is calling, and key checks."""

from datetime import datetime, timezone

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import ApiKey, User
from app.security import SECRET_PREFIX, hash_api_key, rate_limiter, read_session_token


class ApiError(Exception):
    """Every error leaves the API in the same, easy-to-read shape:
    {"error": {"code": "invalid_api_key", "message": "...", "hint": "..."}}
    """

    def __init__(self, status: int, code: str, message: str, hint: str | None = None, headers: dict | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.hint = hint
        self.headers = headers or {}


def client_ip(request: Request) -> str:
    """The visitor's real IP. Visitors can type anything into X-Forwarded-For, so we only trust
    the entry added by our own proxy (counted from the right), never the left-most one."""
    direct = request.client.host if request.client else "unknown"
    fwd = request.headers.get("x-forwarded-for")
    hops = settings.TRUSTED_PROXY_HOPS
    if fwd and settings.is_production and hops > 0:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        if len(parts) >= hops:
            return parts[-hops]
    return direct


def enforce_rate(key: str, limit: int, what: str) -> None:
    ok, retry_after = rate_limiter.allow(key, limit)
    if not ok:
        raise ApiError(
            429,
            "rate_limited",
            f"Too many {what}. Please wait {retry_after} seconds and try again.",
            headers={"Retry-After": str(retry_after)},
        )


# ---------------------------------------------------------------- dashboard login
def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.COOKIE_NAME)
    parsed = read_session_token(token) if token else None
    if not parsed:
        raise ApiError(401, "not_logged_in", "Please log in to continue.")
    user = db.get(User, parsed[0])
    if not user or (user.session_version or 0) != parsed[1]:
        raise ApiError(401, "not_logged_in", "Your session has ended. Please log in again.")
    return user


# ---------------------------------------------------------------- API keys
def _lookup_key(db: Session, raw_key: str) -> ApiKey | None:
    return db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_api_key(raw_key)))


def get_secret_key(request: Request, db: Session = Depends(get_db)) -> ApiKey:
    auth = request.headers.get("authorization", "")
    raw = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    if not raw:
        raise ApiError(
            401,
            "missing_api_key",
            "Add your secret key in the Authorization header.",
            hint="Authorization: Bearer tu_sk_...",
        )
    if not raw.startswith(SECRET_PREFIX):
        raise ApiError(
            401,
            "wrong_key_type",
            "This endpoint needs a SECRET key (tu_sk_...).",
            hint="Public keys (tu_pk_...) only work with the website form endpoint /v1/forms/send.",
        )
    key = _lookup_key(db, raw)
    if not key or key.revoked_at is not None:
        raise ApiError(401, "invalid_api_key", "This API key is invalid or has been revoked.")
    enforce_rate(f"sk:{key.id}", settings.SECRET_KEY_RATE_PER_MINUTE, "requests")
    key.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return key


def check_public_key(db: Session, raw: str, origin: str | None) -> ApiKey:
    if not raw:
        raise ApiError(401, "missing_public_key", "Send your public key in the 'public_key' field.")
    if not raw.startswith("tu_pk_"):
        raise ApiError(
            401,
            "wrong_key_type",
            "Only PUBLIC keys (tu_pk_...) can be used from a website.",
            hint="Never put a secret key (tu_sk_...) in browser code.",
        )
    key = _lookup_key(db, raw)
    if not key or key.revoked_at is not None:
        raise ApiError(401, "invalid_api_key", "This public key is invalid or has been revoked.")
    allowed = [o.rstrip("/").lower() for o in (key.allowed_origins or [])]
    if not origin or origin.rstrip("/").lower() not in allowed:
        raise ApiError(
            403,
            "origin_not_allowed",
            f"The website '{origin or 'unknown'}' is not allowed to use this public key.",
            hint="Add your website address to the key's allowed websites in the ThumbsUp dashboard.",
        )
    return key
