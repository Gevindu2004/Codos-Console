"""The heart of ThumbsUp Email: turn a request into a stored, delivered email."""

import html as html_lib
from email.utils import parseaddr
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import ApiError
from app.models import Domain, EmailMessage, Template, User, new_id
from app.services import queue
from app.services.files import Attachment, download_url, human_size, split_inline_and_links, store_for_download
from app.services.renderer import (
    fields_table_html,
    fields_table_text,
    html_to_text,
    render,
    render_header,
)


def clean_name(value: str | None) -> str | None:
    """Display names go into email headers: no line breaks, no control characters."""
    if not value:
        return value
    value = "".join(ch for ch in value if ch.isprintable())
    return " ".join(value.split())[:120] or None


def clean_email(value: str, field: str) -> str:
    try:
        return validate_email(value.strip(), check_deliverability=False).normalized
    except (EmailNotValidError, AttributeError):
        raise ApiError(422, "invalid_email", f"'{value}' in '{field}' is not a valid email address.")


def clean_list(values: list[str] | str | None, field: str) -> list[str]:
    if not values:
        return []
    if isinstance(values, str):
        values = [v for v in values.replace(";", ",").split(",") if v.strip()]
    out, seen = [], set()
    for v in values:
        e = clean_email(v, field)
        if e.lower() not in seen:
            seen.add(e.lower())
            out.append(e)
    return out


def create_message(
    db: Session,
    *,
    user: User,
    source: str,
    to: list[str],
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    reply_to: str | None = None,
    subject: str | None = None,
    html: str | None = None,
    text: str | None = None,
    template: Template | None = None,
    variables: dict | None = None,
    files: list[Attachment] | None = None,
    from_name: str | None = None,
    from_email: str | None = None,
    tags: list[str] | None = None,
    api_key_id: str | None = None,
    idempotency_key: str | None = None,
    client_ip: str | None = None,
    origin: str | None = None,
    fields_fallback: bool = False,
) -> tuple[EmailMessage, list[Attachment], bool]:
    """Validate the request, save the email + its files, and put it in the delivery queue.

    Returns (message, is_duplicate). Call queue.enqueue(...) afterwards to wake the sender.
    """
    user_id = user.id
    variables = variables or {}
    files = files or []

    if idempotency_key:
        existing = db.scalar(
            select(EmailMessage).where(EmailMessage.user_id == user_id, EmailMessage.idempotency_key == idempotency_key)
        )
        if existing:
            return existing, True

    to_list = clean_list(to, "to")
    cc_list = clean_list(cc, "cc")
    bcc_list = clean_list(bcc, "bcc")
    if not to_list:
        raise ApiError(422, "missing_recipient", "Add at least one recipient in 'to'.")
    if len(to_list) + len(cc_list) + len(bcc_list) > settings.MAX_RECIPIENTS:
        raise ApiError(422, "too_many_recipients", f"One email can have at most {settings.MAX_RECIPIENTS} recipients in total.")
    reply = clean_email(reply_to, "reply_to") if reply_to else None

    # New accounts can only email themselves until they verify their address (stops sign-up spam).
    if not user.email_verified:
        others = [e for e in to_list + cc_list + bcc_list if e.lower() != user.email.lower()]
        if others:
            raise ApiError(
                403,
                "account_not_verified",
                f"Verify your account email first. Until then you can only send to {user.email}.",
                hint="Enter the 6-digit code we emailed you in the ThumbsUp dashboard.",
            )

    # ---- content: template first, then raw values
    if template:
        subj = render_header(template.subject, variables)
        body_html = render(template.html, variables, escape_html=True) if template.html else ""
        body_text = render(template.text, variables, escape_html=False) if template.text else ""
        from_name = from_name or template.from_name
        from_email = from_email or template.from_email or None
    else:
        subj = " ".join((subject or "").split())[:300]
        body_html = html or ""
        body_text = text or ""

    if not body_html.strip() and not body_text.strip() and fields_fallback and variables:
        body_html = fields_table_html(variables)
        body_text = fields_table_text(variables)
    if not subj:
        raise ApiError(422, "missing_subject", "Add a 'subject' (or use a template that has one).")
    if not body_html.strip() and not body_text.strip():
        raise ApiError(422, "missing_content", "Add 'html' or 'text' content (or use a template).")
    if body_html and not body_text:
        body_text = html_to_text(body_html)

    if from_email:  # accept "Acme <hello@acme.com>" as well as "hello@acme.com"
        display, address = parseaddr(from_email)
        from_email = address or from_email
        from_name = from_name or display or None
    from_name = clean_name(from_name)

    message = EmailMessage(
        id=new_id("em"),
        user_id=user_id,
        api_key_id=api_key_id,
        template_id=template.id if template else None,
        source=source,
        status="queued",
        from_email=resolve_from(db, user_id, from_email),
        from_name=(from_name or settings.DEFAULT_FROM_NAME)[:120],
        to=to_list,
        cc=cc_list,
        bcc=bcc_list,
        reply_to=reply,
        subject=subj,
        variables={k: (str(v)[:5000] if not isinstance(v, (int, float, bool)) else v) for k, v in variables.items()},
        tags=[str(t)[:50] for t in (tags or [])][:10],
        idempotency_key=idempotency_key,
        client_ip=client_ip,
        origin=origin,
    )

    # ---- files: small ones attached, big ones turned into secure download links
    inline, linked = split_inline_and_links(files)
    meta = [
        {"filename": f.filename, "size": len(f.data), "content_type": f.content_type, "delivery": "attached"}
        for f in inline
    ]
    if linked:
        link_rows_html, link_rows_text = [], []
        for f in linked:
            stored = store_for_download(db, user_id, message.id, f)
            url = download_url(stored)
            meta.append(
                {
                    "filename": f.filename,
                    "size": len(f.data),
                    "content_type": f.content_type,
                    "delivery": "link",
                    "file_id": stored.id,
                    "expires_at": stored.expires_at.isoformat(),
                }
            )
            name = html_lib.escape(f.filename)
            link_rows_html.append(f'<li><a href="{url}">{name}</a> ({human_size(len(f.data))})</li>')
            link_rows_text.append(f"- {f.filename} ({human_size(len(f.data))}): {url}")
        days = settings.DOWNLOAD_LINK_DAYS
        if body_html:
            body_html += (
                '<div style="margin-top:24px;padding:16px;border:1px solid #e2e8f0;border-radius:10px;'
                'font-family:system-ui,sans-serif;font-size:14px">'
                f"<strong>Files</strong> (links expire in {days} days)<ul>{''.join(link_rows_html)}</ul></div>"
            )
        body_text += f"\n\nFiles (links expire in {days} days):\n" + "\n".join(link_rows_text)

    message.html = body_html
    message.text = body_text
    message.attachments = meta
    db.add(message)
    try:
        db.commit()
    except IntegrityError:  # two identical idempotent requests at the same moment
        db.rollback()
        existing = db.scalar(
            select(EmailMessage).where(EmailMessage.user_id == user_id, EmailMessage.idempotency_key == idempotency_key)
        )
        if existing:
            return existing, True
        raise
    queue.save_attachments(message.id, inline)
    return message, False


def resolve_from(db: Session, user_id: str, from_email: str | None) -> str:
    """Customers may only send from domains they have verified (no spoofing)."""
    if not from_email:
        return settings.DEFAULT_FROM_EMAIL
    address = clean_email(from_email, "from")
    domain = address.rsplit("@", 1)[1].lower()
    owned = db.scalar(select(Domain).where(Domain.name == domain, Domain.user_id == user_id))
    if not owned or owned.status != "verified":
        raise ApiError(
            422,
            "domain_not_verified",
            f"You can't send from {address} yet: the domain {domain} isn't verified in your account.",
            hint="Add and verify the domain under Domains in the ThumbsUp dashboard, or leave 'from' empty.",
        )
    return address


def public_view(msg: EmailMessage) -> dict:
    return {
        "id": msg.id,
        "status": msg.status,
        "source": msg.source,
        "from": f"{msg.from_name} <{msg.from_email}>" if msg.from_name else msg.from_email,
        "to": msg.to,
        "cc": msg.cc,
        "bcc": msg.bcc,
        "reply_to": msg.reply_to,
        "subject": msg.subject,
        "template_id": msg.template_id,
        "attachments": msg.attachments,
        "tags": msg.tags,
        "error": msg.error,
        "suppressed": msg.suppressed or [],
        "attempts": msg.attempts,
        "next_attempt_at": msg.next_attempt_at if msg.status == "queued" else None,
        "created_at": msg.created_at,
        "sent_at": msg.sent_at,
        "delivered_at": msg.delivered_at,
    }
