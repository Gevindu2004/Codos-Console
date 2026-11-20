import secrets

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import ApiError, get_current_user
from app.models import User, WebhookDelivery, WebhookEndpoint
from app.routers.common import get_owned
from app.services import webhooks as wh

router = APIRouter(prefix="/dashboard/webhooks", tags=["Dashboard: webhooks"])


class WebhookIn(BaseModel):
    url: str = Field(min_length=8, max_length=1000)
    events: list[str] = Field(default_factory=lambda: list(wh.EVENTS))
    enabled: bool = True


def view(ep: WebhookEndpoint, show_secret: bool = False) -> dict:
    return {
        "id": ep.id,
        "url": ep.url,
        "events": ep.events,
        "enabled": ep.enabled,
        "secret": ep.secret if show_secret else ep.secret[:10] + "••••••••",
        "created_at": ep.created_at,
    }


def _validate(body: WebhookIn) -> None:
    ok, reason = wh.url_is_allowed(body.url.strip())
    if not ok:
        raise ApiError(422, "invalid_webhook_url", reason)
    bad = [e for e in body.events if e not in wh.EVENTS]
    if bad or not body.events:
        raise ApiError(422, "invalid_events", f"Choose events from: {', '.join(wh.EVENTS)}")


@router.get("")
def list_webhooks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(WebhookEndpoint).where(WebhookEndpoint.user_id == user.id).order_by(WebhookEndpoint.created_at.desc())
    ).all()
    return {"data": [view(r) for r in rows], "events": wh.EVENTS}


@router.post("", status_code=201)
def create_webhook(body: WebhookIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _validate(body)
    ep = WebhookEndpoint(
        user_id=user.id, url=body.url.strip(), events=body.events, enabled=body.enabled, secret="whsec_" + secrets.token_urlsafe(24)
    )
    db.add(ep)
    db.commit()
    return {"data": view(ep, show_secret=True)}


@router.put("/{webhook_id}")
def update_webhook(webhook_id: str, body: WebhookIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ep = get_owned(db, WebhookEndpoint, webhook_id, user)
    _validate(body)
    ep.url, ep.events, ep.enabled = body.url.strip(), body.events, body.enabled
    db.commit()
    return {"data": view(ep)}


@router.get("/{webhook_id}/secret")
def reveal_secret(webhook_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"data": view(get_owned(db, WebhookEndpoint, webhook_id, user), show_secret=True)}


@router.delete("/{webhook_id}")
def delete_webhook(webhook_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned(db, WebhookEndpoint, webhook_id, user))
    db.commit()
    return {"ok": True}


@router.post("/{webhook_id}/test")
def test_webhook(webhook_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ep = get_owned(db, WebhookEndpoint, webhook_id, user)
    record = wh.deliver_one(
        db, ep, "email.sent", {"id": "em_test_123", "status": "sent", "subject": "Test event from ThumbsUp", "test": True}, None
    )
    return {"data": delivery_view(record)}


@router.get("/{webhook_id}/deliveries")
def deliveries(webhook_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ep = get_owned(db, WebhookEndpoint, webhook_id, user)
    rows = db.scalars(
        select(WebhookDelivery)
        .where(WebhookDelivery.endpoint_id == ep.id, WebhookDelivery.user_id == user.id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(30)
    ).all()
    return {"data": [delivery_view(r) for r in rows]}


def delivery_view(r: WebhookDelivery) -> dict:
    return {
        "id": r.id,
        "event": r.event,
        "message_id": r.message_id,
        "success": r.success,
        "status_code": r.status_code,
        "attempts": r.attempts,
        "response": r.response_snippet,
        "created_at": r.created_at,
    }
