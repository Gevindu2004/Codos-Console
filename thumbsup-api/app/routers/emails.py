"""Dashboard: email logs, statistics and the 'send a test email' tool."""

import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import ApiError, get_current_user
from app.models import ApiKey, EmailMessage, Template, User, WebhookEndpoint
from app.routers.common import get_owned
from app.routers.forms_util import read_form
from app.services import delivery, queue
from app.services.delivery import public_view

router = APIRouter(prefix="/dashboard", tags=["Dashboard: emails"])


@router.get("/emails")
def list_emails(
    status: str | None = Query(default=None, pattern="^(queued|sending|sent|delivered|bounced|complained|failed)$"),
    source: str | None = Query(default=None, pattern="^(api|form|dashboard|auto_reply)$"),
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(EmailMessage).where(EmailMessage.user_id == user.id)
    if status:
        stmt = stmt.where(EmailMessage.status == status)
    if source:
        stmt = stmt.where(EmailMessage.source == source)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(EmailMessage.subject.ilike(like), EmailMessage.id.ilike(like), cast(EmailMessage.to, String).ilike(like))
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(EmailMessage.created_at.desc()).limit(limit).offset(offset)).all()
    return {"data": [public_view(m) for m in rows], "total": total, "limit": limit, "offset": offset}


@router.get("/emails/{email_id}")
def get_email(email_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = get_owned(db, EmailMessage, email_id, user)
    return {
        "data": {
            **public_view(m),
            "html": m.html,
            "text": m.text,
            "variables": m.variables,
            "origin": m.origin,
            "client_ip": m.client_ip,
            "provider_message_id": m.provider_message_id,
        }
    }


@router.post("/emails/test", status_code=202)
async def send_test(
    request: Request,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send an email right from the dashboard (same engine as the API)."""
    fields, files = await read_form(request)
    template = None
    if fields.get("template_id"):
        template = get_owned(db, Template, str(fields["template_id"]), user)
    variables = fields.get("variables") or {}
    if isinstance(variables, str):
        try:
            variables = json.loads(variables) if variables.strip() else {}
        except json.JSONDecodeError:
            raise ApiError(422, "invalid_variables", "Template data must be valid JSON, like {\"name\": \"Oshan\"}.")
    if not isinstance(variables, dict):
        raise ApiError(422, "invalid_variables", "Template data must be a JSON object.")
    msg, _ = delivery.create_message(
        db,
        user=user,
        source="dashboard",
        to=fields.get("to") or [],
        cc=fields.get("cc") or [],
        bcc=fields.get("bcc") or [],
        reply_to=fields.get("reply_to") or None,
        subject=fields.get("subject"),
        html=fields.get("html"),
        text=fields.get("text"),
        template=template,
        variables=variables,
        files=files,
        from_name=fields.get("from_name") or None,
        from_email=fields.get("from") or None,
    )
    queue.enqueue(background, msg.id)
    return {"data": public_view(msg)}


@router.get("/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=30)
    rows = db.execute(
        select(EmailMessage.status, EmailMessage.created_at).where(
            EmailMessage.user_id == user.id, EmailMessage.created_at >= since
        )
    ).all()
    by_status = Counter("sent" if r.status in ("sent", "delivered") else ("failed" if r.status in ("failed", "bounced", "complained") else r.status) for r in rows)
    days = [(now - timedelta(days=i)).date() for i in range(13, -1, -1)]
    per_day = Counter()
    for r in rows:
        created = (r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        bucket = "sent" if r.status in ("sent", "delivered") else ("failed" if r.status in ("failed", "bounced", "complained") else "other")
        per_day[(created.date(), bucket)] += 1
    today = now.date()
    return {
        "last_30_days": {
            "total": len(rows),
            "sent": by_status.get("sent", 0),
            "failed": by_status.get("failed", 0),
            "queued": by_status.get("queued", 0) + by_status.get("sending", 0),
        },
        "today": sum(v for (d, _), v in per_day.items() if d == today),
        "daily": [
            {"date": d.isoformat(), "sent": per_day.get((d, "sent"), 0), "failed": per_day.get((d, "failed"), 0)}
            for d in days
        ],
        "counts": {
            "keys": db.scalar(
                select(func.count()).select_from(ApiKey).where(ApiKey.user_id == user.id, ApiKey.revoked_at.is_(None))
            ),
            "templates": db.scalar(select(func.count()).select_from(Template).where(Template.user_id == user.id)),
            "webhooks": db.scalar(
                select(func.count()).select_from(WebhookEndpoint).where(WebhookEndpoint.user_id == user.id)
            ),
            "emails_all_time": db.scalar(
                select(func.count()).select_from(EmailMessage).where(EmailMessage.user_id == user.id)
            ),
        },
    }
