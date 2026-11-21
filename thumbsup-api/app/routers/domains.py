"""Customer sending domains: send as you@yourcompany.com after proving you own the domain.

Uses Amazon SES "Easy DKIM": SES gives three CNAME records; once they are in the
customer's DNS, SES signs every email for that domain and the domain is verified.
"""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import ApiError, get_current_user
from app.models import Domain, User
from app.routers.common import get_owned
from app.services import providers

router = APIRouter(prefix="/dashboard/domains", tags=["Dashboard: sending domains"])

DOMAIN_RE = re.compile(r"^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$")
PUBLIC_MAIL_DOMAINS = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "aol.com", "proton.me"}


class DomainIn(BaseModel):
    name: str = Field(min_length=4, max_length=253)


def view(d: Domain) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "status": d.status,
        "records": d.records,
        "last_checked_at": d.last_checked_at,
        "verified_at": d.verified_at,
        "created_at": d.created_at,
    }


def _require_ses() -> None:
    if settings.EMAIL_PROVIDER.lower() not in ("ses", "log"):
        raise ApiError(
            409,
            "custom_domains_unavailable",
            f"Your own sending domain isn't available on this server yet. Emails are sent from {settings.DEFAULT_FROM_EMAIL}.",
            hint="Set a template's Reply-To to your address, so answers come back to you.",
        )


def _records(name: str, tokens: list[str]) -> list[dict]:
    recs = [
        {
            "type": "CNAME",
            "name": f"{t}._domainkey.{name}",
            "value": f"{t}.dkim.amazonses.com",
            "purpose": "DKIM signature (required)",
            "required": True,
        }
        for t in tokens
    ]
    recs.append(
        {"type": "TXT", "name": name, "value": "v=spf1 include:amazonses.com ~all", "purpose": "SPF (recommended)", "required": False}
    )
    recs.append(
        {"type": "TXT", "name": f"_dmarc.{name}", "value": "v=DMARC1; p=none;", "purpose": "DMARC (recommended)", "required": False}
    )
    return recs


def _ses_tokens(name: str) -> list[str]:
    client = providers.ses_client()
    try:
        resp = client.create_email_identity(EmailIdentity=name)
    except Exception as exc:
        code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
        if code != "AlreadyExistsException":
            raise ApiError(502, "ses_error", f"Amazon SES couldn't add the domain: {exc}") from exc
        resp = client.get_email_identity(EmailIdentity=name)
    return resp.get("DkimAttributes", {}).get("Tokens", [])


@router.get("")
def list_domains(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Domain).where(Domain.user_id == user.id).order_by(Domain.created_at.desc())).all()
    return {"data": [view(d) for d in rows], "provider": settings.EMAIL_PROVIDER.lower(), "default_from": settings.DEFAULT_FROM_EMAIL}


@router.post("", status_code=201)
def add_domain(body: DomainIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_ses()
    if not user.email_verified:
        raise ApiError(403, "account_not_verified", "Verify your account email before adding a sending domain.")
    name = body.name.strip().lower().removeprefix("http://").removeprefix("https://").strip("/").removeprefix("www.")
    if not DOMAIN_RE.match(name):
        raise ApiError(422, "invalid_domain", f"'{body.name}' is not a valid domain. Example: mycompany.com")
    if name in PUBLIC_MAIL_DOMAINS:
        raise ApiError(422, "public_domain", f"You can't verify {name}. Use a domain you own, like mycompany.com.")
    existing = db.scalar(select(Domain).where(Domain.name == name))
    if existing:
        if existing.user_id == user.id:
            return {"data": view(existing)}
        raise ApiError(409, "domain_taken", f"{name} is already registered by another ThumbsUp account.")
    d = Domain(user_id=user.id, name=name, status="pending", records=_records(name, _ses_tokens(name)))
    db.add(d)
    db.commit()
    return {"data": view(d)}


@router.post("/{domain_id}/check")
def check_domain(domain_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = get_owned(db, Domain, domain_id, user)
    _require_ses()
    try:
        resp = providers.ses_client().get_email_identity(EmailIdentity=d.name)
    except Exception as exc:
        raise ApiError(502, "ses_error", f"Amazon SES couldn't check the domain: {exc}") from exc
    dkim = resp.get("DkimAttributes", {}).get("Status", "PENDING")
    if resp.get("VerifiedForSendingStatus") and dkim == "SUCCESS":
        if d.status != "verified":
            d.verified_at = datetime.now(timezone.utc)
        d.status = "verified"
    elif dkim == "FAILED":
        d.status = "failed"
    else:
        d.status = "pending"
    d.last_checked_at = datetime.now(timezone.utc)
    db.commit()
    return {"data": view(d)}


@router.delete("/{domain_id}")
def delete_domain(domain_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = get_owned(db, Domain, domain_id, user)
    if settings.EMAIL_PROVIDER.lower() == "ses":
        try:
            providers.ses_client().delete_email_identity(EmailIdentity=d.name)
        except Exception:
            pass  # already gone in SES
    db.delete(d)
    db.commit()
    return {"ok": True}
