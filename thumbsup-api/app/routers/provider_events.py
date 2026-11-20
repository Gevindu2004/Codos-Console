"""Delivery events from Amazon SES (via Amazon SNS): delivered, bounced, complained.

Set this up once in AWS:
  1. SES -> Configuration sets -> create one (put its name in SES_CONFIGURATION_SET)
  2. Add an event destination: Amazon SNS topic, events: Delivery, Bounce, Complaint
  3. SNS topic -> create an HTTPS subscription to:
       https://<your-api>/v1/providers/ses/events/<SES_EVENTS_TOKEN>
     ThumbsUp confirms the subscription automatically.
"""

import hmac
import json
import logging
import re
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import ApiError
from app.models import EmailMessage
from app.services.delivery import public_view
from app.services.queue import _notify, suppress

router = APIRouter(prefix="/v1/providers", tags=["Provider events"], include_in_schema=False)
log = logging.getLogger("thumbsup.events")

SNS_HOST = re.compile(r"^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$")


@router.post("/ses/events/{token}")
async def ses_events(token: str, request: Request, db: Session = Depends(get_db)):
    if not settings.SES_EVENTS_TOKEN or not hmac.compare_digest(token, settings.SES_EVENTS_TOKEN):
        raise ApiError(404, "not_found", "Not found.")
    try:
        envelope = json.loads(await request.body())
    except ValueError:
        raise ApiError(400, "invalid_json", "Expected an SNS JSON message.")

    kind = envelope.get("Type")
    if kind == "SubscriptionConfirmation":
        url = envelope.get("SubscribeURL", "")
        host = httpx.URL(url).host if url.startswith("https://") else ""
        if not SNS_HOST.match(host or ""):
            raise ApiError(400, "invalid_subscription", "SubscribeURL is not an Amazon SNS address.")
        httpx.get(url, timeout=10)
        return {"ok": True, "subscribed": True}
    if kind != "Notification":
        return {"ok": True}

    try:
        event = json.loads(envelope.get("Message", "{}"))
    except ValueError:
        return {"ok": True}
    handle_ses_event(db, event)
    return {"ok": True}


def handle_ses_event(db: Session, event: dict) -> None:
    etype = (event.get("eventType") or event.get("notificationType") or "").lower()
    mail = event.get("mail", {})
    msg = None
    headers = {h.get("name", "").lower(): h.get("value") for h in mail.get("headers", [])}
    if headers.get("x-thumbsup-message-id"):
        msg = db.get(EmailMessage, headers["x-thumbsup-message-id"])
    if msg is None and mail.get("messageId"):
        msg = db.scalar(select(EmailMessage).where(EmailMessage.provider_message_id == mail["messageId"]))
    if msg is None:
        return  # not one of ours (or a system email)

    now = datetime.now(timezone.utc)
    if etype == "delivery":
        if msg.status == "sent":
            msg.status, msg.delivered_at = "delivered", now
            db.commit()
            _notify(msg.user_id, "email.delivered", public_view(msg), msg.id)
    elif etype == "bounce":
        bounce = event.get("bounce", {})
        if bounce.get("bounceType") != "Permanent":
            return  # soft bounce: the mail server will keep trying
        for r in bounce.get("bouncedRecipients", []):
            suppress(db, msg.user_id, r.get("emailAddress", ""), "bounce", r.get("diagnosticCode", "Permanent bounce"), msg.id)
        msg.status = "bounced"
        msg.error = "The recipient's mail server permanently rejected this email (the address may not exist)."
        db.commit()
        _notify(msg.user_id, "email.bounced", public_view(msg), msg.id)
    elif etype == "complaint":
        for r in event.get("complaint", {}).get("complainedRecipients", []):
            suppress(db, msg.user_id, r.get("emailAddress", ""), "complaint", "Marked the email as spam", msg.id)
        msg.status = "complained"
        db.commit()
        _notify(msg.user_id, "email.complained", public_view(msg), msg.id)


# ====================================================================== Azure Communication Services (Event Grid)
# Set this up once in Azure:
#   Communication Services resource -> Events -> + Event Subscription
#     Event types: Email Delivery Report Received
#     Endpoint type: Web Hook
#     URL: https://<your-api>/v1/providers/acs/events/<ACS_EVENTS_TOKEN>
#   ThumbsUp answers Event Grid's validation handshake automatically.
ACS_STATUS = {
    "delivered": "delivered",
    "bounced": "bounced",  # the address doesn't exist / domain invalid
    "suppressed": "bounced",  # Azure is blocking this address because it hard-bounced before
    "filteredspam": "failed",  # rejected as spam by the receiving server
    "quarantined": "failed",
    "failed": "failed",
}


@router.post("/acs/events/{token}")
async def acs_events(token: str, request: Request, db: Session = Depends(get_db)):
    if not settings.ACS_EVENTS_TOKEN or not hmac.compare_digest(token, settings.ACS_EVENTS_TOKEN):
        raise ApiError(404, "not_found", "Not found.")
    try:
        body = json.loads(await request.body())
    except ValueError:
        raise ApiError(400, "invalid_json", "Expected Event Grid JSON.")
    events = body if isinstance(body, list) else [body]
    for ev in events[:500]:
        if not isinstance(ev, dict):
            continue
        etype = ev.get("eventType") or ev.get("type") or ""  # Event Grid schema or CloudEvents schema
        data = ev.get("data") or {}
        if etype == "Microsoft.EventGrid.SubscriptionValidationEvent":
            return {"validationResponse": str(data.get("validationCode", ""))}
        if etype == "Microsoft.Communication.EmailDeliveryReportReceived" and isinstance(data, dict):
            handle_acs_report(db, data)
    return {"ok": True}


@router.options("/acs/events/{token}")
async def acs_events_handshake(token: str, request: Request):
    """CloudEvents-schema subscriptions validate with an OPTIONS request."""
    if not settings.ACS_EVENTS_TOKEN or not hmac.compare_digest(token, settings.ACS_EVENTS_TOKEN):
        raise ApiError(404, "not_found", "Not found.")
    from fastapi.responses import Response

    origin = request.headers.get("webhook-request-origin", "")
    return Response(status_code=200, headers={"WebHook-Allowed-Origin": origin or "*", "WebHook-Allowed-Rate": "1000"})


def handle_acs_report(db: Session, data: dict) -> None:
    op_id = str(data.get("messageId") or "")
    if not op_id:
        return
    msg = db.scalar(select(EmailMessage).where(EmailMessage.provider_message_id == op_id))
    if msg is None:
        return  # not one of ours
    status = ACS_STATUS.get(str(data.get("status", "")).lower())
    recipient = str(data.get("recipient") or "")
    detail = str((data.get("deliveryStatusDetails") or {}).get("statusMessage") or "")[:300]
    now = datetime.now(timezone.utc)
    if status == "delivered":
        if msg.status == "sent":
            msg.status, msg.delivered_at = "delivered", now
            db.commit()
            _notify(msg.user_id, "email.delivered", public_view(msg), msg.id)
    elif status == "bounced":
        if recipient:
            suppress(db, msg.user_id, recipient, "bounce", detail or "Permanent bounce", msg.id)
        msg.status = "bounced"
        msg.error = "The recipient's mail server permanently rejected this email (the address may not exist)."
        db.commit()
        _notify(msg.user_id, "email.bounced", public_view(msg), msg.id)
    elif status == "failed":
        if msg.status in ("sent", "delivered"):
            msg.status = "failed"
            msg.error = f"Not delivered to {recipient or 'the recipient'}: " + (detail or str(data.get("status")))
            db.commit()
            _notify(msg.user_id, "email.failed", public_view(msg), msg.id)
