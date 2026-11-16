import hashlib
import secrets
from cryptography.fernet import Fernet
from app.core.config import settings


def get_fernet() -> Fernet:
    key = settings.DB_CREDENTIAL_ENCRYPTION_KEY
    # Fallback deterministic dev key if user hasn't set one yet in .env
    if key.startswith("CHANGE_ME"):
        key = Fernet.generate_key().decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plain_text: str) -> str:
    return get_fernet().encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_secret(cipher_text: str) -> str:
    return get_fernet().decrypt(cipher_text.encode("utf-8")).decode("utf-8")


def generate_skybeak_api_key() -> tuple[str, str, str]:
    """
    Returns (raw_api_key, key_prefix, sha256_hash).
    Raw key is shown once to the developer; only prefix + hash are stored in Azure PostgreSQL.
    """
    raw_token = secrets.token_urlsafe(32)
    raw_key = f"sb_live_{raw_token}"
    key_prefix = raw_key[:14] + "..."
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return raw_key, key_prefix, key_hash


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()