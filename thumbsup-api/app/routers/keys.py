from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import ApiError, get_current_user
from app.models import ApiKey, User
from app.routers.common import get_owned
from app.security import display_prefix, generate_api_key, hash_api_key

router = APIRouter(prefix="/dashboard/keys", tags=["Dashboard: API keys"])


class KeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: str = Field(pattern="^(secret|public)$")
    allowed_origins: list[str] = Field(default_factory=list, max_length=20)


class KeyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    allowed_origins: list[str] | None = Field(default=None, max_length=20)


def normalize_origins(origins: list[str]) -> list[str]:
    out = []
    for raw in origins:
        raw = raw.strip()
        if not raw:
            continue
        if "://" not in raw:
            raw = "https://" + raw
        p = urlparse(raw)
        if p.scheme not in ("http", "https") or not p.hostname:
            raise ApiError(422, "invalid_origin", f"'{raw}' is not a website address. Example: https://mysite.com")
        origin = f"{p.scheme}://{p.hostname.lower()}" + (f":{p.port}" if p.port else "")
        if origin not in out:
            out.append(origin)
    return out


def key_view(k: ApiKey, full_key: str | None = None) -> dict:
    return {
        "id": k.id,
        "name": k.name,
        "kind": k.kind,
        "prefix": k.prefix,
        "key": full_key or (k.public_value if k.kind == "public" else None),
        "allowed_origins": k.allowed_origins or [],
        "last_used_at": k.last_used_at,
        "created_at": k.created_at,
        "revoked": k.revoked_at is not None,
    }


@router.get("")
def list_keys(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = db.scalars(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.revoked_at.is_(None)).order_by(ApiKey.created_at.desc())
    ).all()
    return {"data": [key_view(k) for k in keys]}


@router.post("", status_code=201)
def create_key(body: KeyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    origins = normalize_origins(body.allowed_origins)
    if body.kind == "public" and not origins:
        raise ApiError(
            422,
            "origins_required",
            "Add at least one website that may use this public key (for example https://mysite.com).",
            hint="This stops other websites from copying your key and using your quota.",
        )
    raw = generate_api_key(body.kind)
    key = ApiKey(
        user_id=user.id,
        name=body.name.strip(),
        kind=body.kind,
        prefix=display_prefix(raw),
        key_hash=hash_api_key(raw),
        public_value=raw if body.kind == "public" else None,
        allowed_origins=origins if body.kind == "public" else [],
    )
    db.add(key)
    db.commit()
    # The full secret key is returned ONLY in this response.
    return {"data": key_view(key, full_key=raw)}


@router.patch("/{key_id}")
def update_key(key_id: str, body: KeyUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = get_owned(db, ApiKey, key_id, user)
    if key.revoked_at:
        raise ApiError(404, "not_found", "Key not found.")
    if body.name is not None:
        key.name = body.name.strip()
    if body.allowed_origins is not None:
        if key.kind != "public":
            raise ApiError(422, "not_public_key", "Only public keys have allowed websites.")
        origins = normalize_origins(body.allowed_origins)
        if not origins:
            raise ApiError(422, "origins_required", "A public key needs at least one allowed website.")
        key.allowed_origins = origins
    db.commit()
    return {"data": key_view(key)}


@router.delete("/{key_id}")
def revoke_key(key_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = get_owned(db, ApiKey, key_id, user)
    if key.revoked_at is None:
        key.revoked_at = datetime.now(timezone.utc)
        key.public_value = None
        db.commit()
    return {"ok": True}
