"""Passwords, login sessions, API keys and rate limiting."""

import base64
import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

# ---------------------------------------------------------------- passwords
# scrypt (memory-hard, from Python's standard library) with a random salt per user.
_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, digest_b64 = stored.split("$")
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
    except ValueError:
        return False
    actual = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return hmac.compare_digest(actual, expected)


# A fixed hash used when the email does not exist, so login takes the same time either way
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


# ---------------------------------------------------------------- sessions
def create_session_token(user_id: str, session_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "sv": session_version, "iat": now,
               "exp": now + timedelta(hours=settings.SESSION_HOURS), "typ": "session"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def read_session_token(token: str) -> tuple[str, int] | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != "session" or not payload.get("sub"):
        return None
    return payload["sub"], int(payload.get("sv", 0))


# ---------------------------------------------------------------- API keys
SECRET_PREFIX = "tu_sk_"
PUBLIC_PREFIX = "tu_pk_"


def generate_api_key(kind: str) -> str:
    prefix = SECRET_PREFIX if kind == "secret" else PUBLIC_PREFIX
    return prefix + secrets.token_urlsafe(32)


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def display_prefix(raw_key: str) -> str:
    return raw_key[:12]


def sign_webhook(secret: str, timestamp: str, body: bytes) -> str:
    mac = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256)
    return mac.hexdigest()


# ---------------------------------------------------------------- rate limiting
class RateLimiter:
    """Sliding-window limiter kept in memory (swap for Redis when running several servers)."""

    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: int = 60) -> tuple[bool, int]:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                retry_after = int(window_seconds - (now - hits[0])) + 1
                return False, retry_after
            hits.append(now)
            return True, 0

    def count(self, key: str, window_seconds: int = 60) -> tuple[int, int]:
        """(hits in window, seconds until the oldest expires) without adding a hit."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            return len(hits), (int(window_seconds - (now - hits[0])) + 1 if hits else 0)

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def reset(self):
        with self._lock:
            self._hits.clear()


rate_limiter = RateLimiter()
