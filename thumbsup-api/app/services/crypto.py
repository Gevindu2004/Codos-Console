"""Encryption for secrets we must store (customers' Google refresh tokens).

The key comes from DATA_ENCRYPTION_KEY (on Azure: an App Setting that references Key Vault).
A database leak alone is then not enough to use anyone's Google account.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _fernet() -> Fernet:
    if not settings.DATA_ENCRYPTION_KEY:
        raise RuntimeError("DATA_ENCRYPTION_KEY is not set.")
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.DATA_ENCRYPTION_KEY.encode()).digest())
    return Fernet(key)


def encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Stored secret can't be decrypted (was DATA_ENCRYPTION_KEY changed?).") from exc
