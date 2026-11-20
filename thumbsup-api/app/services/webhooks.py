"""Signed webhooks: tell the customer's server what happened to each email.

Every request carries:
  ThumbsUp-Timestamp: <unix seconds>
  ThumbsUp-Signature: v1=<hex HMAC-SHA256 of "<timestamp>.<raw body>" using the endpoint secret>
"""

import ipaddress
import json
import socket
import time
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import WebhookDelivery, WebhookEndpoint
from app.security import sign_webhook

EVENTS = ["email.sent", "email.delivered", "email.bounced", "email.complained", "email.failed", "form.received"]
RETRY_DELAYS = [0, 2, 5]  # seconds between attempts (a queue/worker will replace this later)


def url_is_allowed(url: str) -> tuple[bool, str]:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False, "The URL must start with http:// or https://"
    if settings.is_production and parsed.scheme != "https":
        return False, "Webhook URLs must use https:// in production."
    if not settings.private_webhooks_allowed:
        try:
            infos = socket.getaddrinfo(parsed.hostname, None)
        except socket.gaierror:
            return False, "That address could not be found."
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False, "Webhooks can't point to private or internal network addresses."
    return True, ""


def dispatch(db: Session, user_id: str, event: str, data: dict, message_id: str | None = None) -> None:
    endpoints = db.scalars(
        select(WebhookEndpoint).where(WebhookEndpoint.user_id == user_id, WebhookEndpoint.enabled.is_(True))
    ).all()
    for ep in endpoints:
        if ep.events and event not in ep.events:
            continue
        deliver_one(db, ep, event, data, message_id)


def deliver_one(db: Session, ep: WebhookEndpoint, event: str, data: dict, message_id: str | None) -> WebhookDelivery:
    body = json.dumps({"type": event, "created_at": int(time.time()), "data": data}, default=str).encode()
    record = WebhookDelivery(
        user_id=ep.user_id, endpoint_id=ep.id, event=event, message_id=message_id, attempts=0, success=False, response_snippet=""
    )
    db.add(record)
    ok, reason = url_is_allowed(ep.url)
    if not ok:
        record.response_snippet = reason
        db.commit()
        return record
    for delay in RETRY_DELAYS:
        if delay:
            time.sleep(delay)
        record.attempts += 1
        ts = str(int(time.time()))
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ThumbsUp-Webhooks/1.0",
            "ThumbsUp-Event": event,
            "ThumbsUp-Timestamp": ts,
            "ThumbsUp-Signature": "v1=" + sign_webhook(ep.secret, ts, body),
        }
        try:
            resp = httpx.post(ep.url, content=body, headers=headers, timeout=8.0, follow_redirects=False)
            record.status_code = resp.status_code
            record.response_snippet = resp.text[:300]
            if 200 <= resp.status_code < 300:
                record.success = True
                break
        except httpx.HTTPError as exc:
            record.response_snippet = f"Could not reach the URL: {exc.__class__.__name__}"
    db.commit()
    return record
