"""Per-tenant Google Calendar client for CallColleague.ai.

Ported from the Amja Travels Node webhook (`calendar.js`, `checkAvailability.js`,
`bookAppointment.js`, `cancelAppointment.js`) but multi-tenant: every tenant stores
its own encrypted OAuth refresh token in `cc_tenant_integrations`.

Uses plain httpx against Google's REST APIs (no extra dependencies).
"""

import json
import time
import urllib.parse
from datetime import datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.call_colleague import CcTenantIntegration

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_API = "https://www.googleapis.com/calendar/v3"
SCOPES = "https://www.googleapis.com/auth/calendar openid email"

# access-token cache: tenant_id -> (token, expires_epoch)
_token_cache: dict[str, tuple[str, float]] = {}
# freebusy cache: (tenant_id, date) -> (busy, expires_epoch)  (3 min, like the Node app)
_busy_cache: dict[tuple[str, str], tuple[list[dict[str, str]], float]] = {}


def is_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def _fernet() -> Fernet:
    return Fernet(settings.DB_CREDENTIAL_ENCRYPTION_KEY.encode())


def encrypt_credentials(data: dict[str, Any]) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_credentials(token: str) -> dict[str, Any]:
    return json.loads(_fernet().decrypt(token.encode()).decode())


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------
def build_auth_url(tenant_id: str) -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": tenant_id,
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


async def exchange_code(code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Google token exchange failed: {res.text}")
    return res.json()


async def fetch_account_email(access_token: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    return res.json().get("email") if res.status_code < 400 else None


async def save_integration(
    db: AsyncSession, tenant_id: str, refresh_token: str, email: Optional[str]
) -> None:
    res = await db.execute(
        select(CcTenantIntegration).where(
            CcTenantIntegration.tenant_id == tenant_id,
            CcTenantIntegration.provider == "google_calendar",
        )
    )
    row = res.scalar_one_or_none()
    blob = encrypt_credentials({"refresh_token": refresh_token})
    if row:
        row.encrypted_credentials = blob
        row.account_email = email
        row.updated_at = datetime.utcnow()
    else:
        db.add(
            CcTenantIntegration(
                id=f"int_{tenant_id}_gcal"[:64],
                tenant_id=tenant_id,
                encrypted_credentials=blob,
                account_email=email,
            )
        )
    _token_cache.pop(tenant_id, None)


async def get_integration(
    db: AsyncSession, tenant_id: str
) -> Optional[CcTenantIntegration]:
    res = await db.execute(
        select(CcTenantIntegration).where(
            CcTenantIntegration.tenant_id == tenant_id,
            CcTenantIntegration.provider == "google_calendar",
        )
    )
    return res.scalar_one_or_none()


async def _access_token(tenant_id: str, integ: CcTenantIntegration) -> str:
    cached = _token_cache.get(tenant_id)
    if cached and cached[1] > time.time() + 60:
        return cached[0]
    refresh = decrypt_credentials(integ.encrypted_credentials)["refresh_token"]
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh,
                "grant_type": "refresh_token",
            },
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Google token refresh failed: {res.text}")
    data = res.json()
    _token_cache[tenant_id] = (data["access_token"], time.time() + int(data.get("expires_in", 3600)))
    return data["access_token"]


# ---------------------------------------------------------------------------
# Calendar operations
# ---------------------------------------------------------------------------
async def get_busy(
    tenant_id: str,
    integ: CcTenantIntegration,
    day_start: datetime,
    day_end: datetime,
    tz: ZoneInfo,
) -> list[dict[str, str]]:
    key = (tenant_id, day_start.strftime("%Y-%m-%d"))
    cached = _busy_cache.get(key)
    if cached and cached[1] > time.time():
        return cached[0]

    token = await _access_token(tenant_id, integ)
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{GOOGLE_API}/freeBusy",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "timeMin": day_start.astimezone(tz).isoformat(),
                "timeMax": day_end.astimezone(tz).isoformat(),
                "items": [{"id": integ.calendar_id}],
            },
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Google freeBusy failed: {res.text}")
    busy = res.json()["calendars"][integ.calendar_id].get("busy", [])
    _busy_cache[key] = (busy, time.time() + 180)
    return busy


async def insert_event(
    tenant_id: str,
    integ: CcTenantIntegration,
    summary: str,
    description: str,
    start: datetime,
    end: datetime,
    tz_name: str,
) -> str:
    token = await _access_token(tenant_id, integ)
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{GOOGLE_API}/calendars/{urllib.parse.quote(integ.calendar_id)}/events",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "summary": summary,
                "description": description,
                "start": {"dateTime": start.isoformat(), "timeZone": tz_name},
                "end": {"dateTime": end.isoformat(), "timeZone": tz_name},
                "reminders": {"useDefault": True},
            },
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Google event insert failed: {res.text}")
    _busy_cache.pop((tenant_id, start.strftime("%Y-%m-%d")), None)
    return res.json()["id"]


async def delete_event(
    tenant_id: str, integ: CcTenantIntegration, event_id: str
) -> None:
    token = await _access_token(tenant_id, integ)
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.delete(
            f"{GOOGLE_API}/calendars/{urllib.parse.quote(integ.calendar_id)}/events/{event_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    _busy_cache.clear()


def overlaps(busy: list[dict[str, str]], slot_start: datetime, slot_end: datetime) -> bool:
    for b in busy:
        b_start = datetime.fromisoformat(b["start"].replace("Z", "+00:00"))
        b_end = datetime.fromisoformat(b["end"].replace("Z", "+00:00"))
        if slot_start < b_end and slot_end > b_start:
            return True
    return False


__all__ = [
    "is_configured",
    "build_auth_url",
    "exchange_code",
    "fetch_account_email",
    "save_integration",
    "get_integration",
    "get_busy",
    "insert_event",
    "delete_event",
    "overlaps",
    "timedelta",
]
