"""The public ThumbsUp Email API that customers' apps and websites call.

  POST /v1/emails          send from a server       (secret key: Authorization: Bearer tu_sk_...)
  GET  /v1/emails/{id}     check an email's status   (secret key)
  POST /v1/forms/send      send from a website form  (public key + allowed website)
  GET  /v1/files/{token}   download a large file that was sent as a link
"""

import base64
import binascii
import os
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import ApiError, check_public_key, client_ip, enforce_rate, get_secret_key
from app.models import ApiKey, EmailMessage, StoredFile, Template, User
from app.routers.forms_util import read_form
from app.services import delivery, queue, webhooks
from app.services.delivery import clean_email, public_view
from app.services.files import validate_attachment

router = APIRouter(prefix="/v1", tags=["Public API"])

# Field names with a special meaning in website forms (everything else becomes template data)
RESERVED_FORM_FIELDS = {"public_key", "template_id", "_honey", "_gotcha", "_redirect"}
HONEYPOT_FIELDS = ("_honey", "_gotcha")


class AttachmentIn(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content: str = Field(description="File bytes encoded as base64")
    content_type: str | None = Field(default=None, max_length=120)


class SendEmailIn(BaseModel):
    model_config = {"populate_by_name": True}

    from_: str | None = Field(default=None, alias="from", max_length=320, description="Sender on a verified domain")
    to: list[str] | str
    cc: list[str] | str | None = None
    bcc: list[str] | str | None = None
    reply_to: str | None = None
    subject: str | None = Field(default=None, max_length=300)
    html: str | None = Field(default=None, max_length=500_000)
    text: str | None = Field(default=None, max_length=200_000)
    template_id: str | None = None
    variables: dict = Field(default_factory=dict)
    from_name: str | None = Field(default=None, max_length=120)
    attachments: list[AttachmentIn] = Field(default_factory=list, max_length=10)
    tags: list[str] = Field(default_factory=list, max_length=10)


def _owned_template(db: Session, template_id: str, user_id: str) -> Template:
    t = db.get(Template, template_id)
    if not t or t.user_id != user_id:
        raise ApiError(404, "template_not_found", f"Template '{template_id}' was not found in your account.")
    return t


@router.post("/emails", status_code=202)
def send_email(
    body: SendEmailIn,
    request: Request,
    background: BackgroundTasks,
    key: ApiKey = Depends(get_secret_key),
    idempotency_key: str | None = Header(default=None, max_length=120),
    db: Session = Depends(get_db),
):
    user = db.get(User, key.user_id)
    template = _owned_template(db, body.template_id, key.user_id) if body.template_id else None
    files = []
    for a in body.attachments:
        try:
            data = base64.b64decode(a.content, validate=True)
        except (binascii.Error, ValueError):
            raise ApiError(422, "invalid_attachment", f"Attachment '{a.filename}' is not valid base64.")
        files.append(validate_attachment(a.filename, a.content_type, data))

    msg, duplicate = delivery.create_message(
        db,
        user=user,
        source="api",
        api_key_id=key.id,
        to=body.to,
        cc=body.cc,
        bcc=body.bcc,
        reply_to=body.reply_to,
        subject=body.subject,
        html=body.html,
        text=body.text,
        template=template,
        variables=body.variables,
        files=files,
        from_name=body.from_name,
        from_email=body.from_,
        tags=body.tags,
        idempotency_key=idempotency_key,
        client_ip=client_ip(request),
    )
    if duplicate:
        return JSONResponse(
            status_code=200, content={"id": msg.id, "status": msg.status, "duplicate": True}, headers={"Idempotent-Replayed": "true"}
        )
    queue.enqueue(background, msg.id)
    return {"id": msg.id, "status": msg.status}


@router.get("/emails/{email_id}")
def get_email_status(email_id: str, key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    m = db.get(EmailMessage, email_id)
    if not m or m.user_id != key.user_id:
        raise ApiError(404, "not_found", "Email not found.")
    return public_view(m)


@router.post("/forms/send", status_code=202)
async def send_form(request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    origin = request.headers.get("origin")
    ip = client_ip(request)
    # Checked BEFORE reading the body, so nobody can flood us with uploads without a valid key
    enforce_rate(f"formip:{ip}", settings.PUBLIC_FORM_RATE_PER_MINUTE * 3, "form submissions from your network")
    fields, files = await read_form(request, max_files=5)

    key = check_public_key(db, str(fields.get("public_key") or request.headers.get("x-thumbsup-key") or ""), origin)
    enforce_rate(f"pk:{key.id}:{ip}", settings.PUBLIC_FORM_RATE_PER_MINUTE, "form submissions from your network")
    enforce_rate(f"pk:{key.id}", settings.PUBLIC_FORM_RATE_PER_MINUTE * 10, "form submissions for this website")

    # Bots fill every field, people never see the hidden honeypot. Pretend success, send nothing.
    if any(str(fields.get(h) or "").strip() for h in HONEYPOT_FIELDS):
        return {"id": "em_ignored", "status": "queued"}

    template_id = str(fields.get("template_id") or "")
    if not template_id:
        raise ApiError(422, "missing_template", "Add a 'template_id' field to your form.")
    template = _owned_template(db, template_id, key.user_id)
    user = db.get(User, key.user_id)
    if not template.allow_public:
        raise ApiError(
            403,
            "template_not_public",
            "This template is not enabled for website forms.",
            hint="Turn on 'Use with website forms' for this template in the dashboard.",
        )

    variables = {k: v for k, v in fields.items() if k not in RESERVED_FORM_FIELDS}
    visitor_email = None
    for candidate in ("email", "reply_to", "from_email"):
        if variables.get(candidate):
            try:
                visitor_email = clean_email(str(variables[candidate]), candidate)
                break
            except ApiError:
                pass

    # Public keys can ONLY deliver to the template's fixed recipients (anti-spam).
    msg, _ = delivery.create_message(
        db,
        user=user,
        source="form",
        api_key_id=key.id,
        to=template.to_emails,
        reply_to=visitor_email,
        template=template,
        variables=variables,
        files=files,
        client_ip=ip,
        origin=origin,
        fields_fallback=True,
    )
    queue.enqueue(background, msg.id)
    background.add_task(_form_received_webhook, key.user_id, msg.id)

    if template.auto_reply and visitor_email and user.email_verified and not _auto_replied_recently(db, user.id, visitor_email):
        # Spammers type adverts + links into the name field and a victim's address into "email",
        # hoping the auto-reply delivers their text. So: short values, no links, once per address a day.
        safe_vars = {k: _plain_short(v) for k, v in variables.items()}
        reply, _ = delivery.create_message(
            db,
            user=user,
            source="auto_reply",
            api_key_id=key.id,
            to=[visitor_email],
            reply_to=(template.to_emails or [None])[0],
            subject=delivery.render_header(template.auto_reply_subject, safe_vars),
            text=delivery.render(template.auto_reply_text, safe_vars, escape_html=False),
            from_name=template.from_name or None,
            from_email=template.from_email or None,
            client_ip=ip,
            origin=origin,
        )
        queue.enqueue(background, reply.id)

    return {"id": msg.id, "status": msg.status}


_LINKS = re.compile(r"(https?://\S+|www\.\S+|\b[\w-]+(\.[\w-]+)*\.(com|net|org|info|biz|io|co|ru|xyz|top|site|shop|click|link|online|me|app)\b\S*)", re.I)


def _plain_short(value) -> str:
    text = _LINKS.sub("", str(value or ""))
    return " ".join(text.split())[:60]


def _auto_replied_recently(db: Session, user_id: str, address: str) -> bool:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = db.scalars(
        select(EmailMessage.to).where(
            EmailMessage.user_id == user_id, EmailMessage.source == "auto_reply", EmailMessage.created_at >= since
        )
    ).all()
    return any(address.lower() in [a.lower() for a in to] for to in rows)


def _form_received_webhook(user_id: str, message_id: str) -> None:
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        m = db.get(EmailMessage, message_id)
        if m:
            webhooks.dispatch(db, user_id, "form.received", {**public_view(m), "fields": m.variables}, m.id)
    finally:
        db.close()


@router.get("/files/{token}")
def download_file(token: str, db: Session = Depends(get_db)):
    f = db.scalar(select(StoredFile).where(StoredFile.download_token == token))
    if not f:
        raise ApiError(404, "file_not_found", "This download link is not valid.")
    expires = f.expires_at if f.expires_at.tzinfo else f.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise ApiError(410, "link_expired", "This download link has expired. Ask the sender to send the file again.")
    f.downloads += 1
    db.commit()
    headers = {"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
               "Content-Security-Policy": "default-src 'none'; sandbox"}
    from app.services.asset_storage import get_storage

    store = get_storage()
    local = f.path if os.path.isabs(f.path) else store.local_path(f.path)  # absolute = saved by an older version
    if local:
        if not os.path.exists(local):
            raise ApiError(404, "file_not_found", "This file is no longer available.")
        return FileResponse(local, media_type=f.content_type, filename=f.filename, content_disposition_type="attachment",
                            headers=headers)
    try:
        body, length, _ = store.open_range(f.path, None, None)
    except Exception as exc:  # noqa: BLE001 - missing blob
        raise ApiError(404, "file_not_found", "This file is no longer available.") from exc
    from urllib.parse import quote

    headers["Content-Disposition"] = f"attachment; filename*=utf-8''{quote(f.filename)}"
    if length is not None:
        headers["Content-Length"] = str(length)
    return StreamingResponse(body.iter_chunks(256 * 1024), media_type=f.content_type, headers=headers)
