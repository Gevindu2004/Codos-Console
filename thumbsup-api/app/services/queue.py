"""Persistent delivery queue.

Every email is saved in the database as "queued" BEFORE we answer the API call, and
its attachments are saved to disk. A background worker then delivers it. Because the
queue lives in the database, nothing is lost if the server restarts, and temporary
failures (mail server down, rate limits) are retried automatically with backoff.

Several API processes can run the worker at once: each email is "claimed" with an
atomic UPDATE, so it is never sent twice.
"""

import json
import logging
import os
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update

from app.config import settings
from app.db import SessionLocal
from app.models import AuthCode, EmailMessage, StoredFile, Suppression
from app.services import providers, webhooks
from app.services.asset_storage import get_storage
from app.services.files import Attachment

log = logging.getLogger("thumbsup.queue")

# Wait before retry number 1, 2, 3, ... (temporary failures only)
BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360]
STUCK_AFTER_MINUTES = 10

_wake = threading.Event()
_stop = threading.Event()
_thread: threading.Thread | None = None
_webhook_pool: ThreadPoolExecutor | None = None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- attachments waiting to be sent
# Kept in the shared file storage (Azure Blob / S3 / local disk), so whichever server copy picks
# the email up can read them, and a restart doesn't lose them.
def _pending_prefix(message_id: str) -> str:
    return f"email/pending/{message_id}/"


def save_attachments(message_id: str, attachments: list[Attachment]) -> None:
    if not attachments:
        return
    store = get_storage()
    manifest = []
    for i, a in enumerate(attachments):
        store.put_bytes(f"{_pending_prefix(message_id)}{i}.bin", a.data, "application/octet-stream")
        manifest.append({"file": f"{i}.bin", "filename": a.filename, "content_type": a.content_type})
    store.put_bytes(f"{_pending_prefix(message_id)}manifest.json", json.dumps(manifest).encode(), "application/json")


def load_attachments(message_id: str) -> list[Attachment]:
    store = get_storage()
    key = f"{_pending_prefix(message_id)}manifest.json"
    if not store.exists(key):
        legacy = os.path.join(settings.STORAGE_DIR, "pending", message_id, "manifest.json")  # older versions
        if not os.path.exists(legacy):
            return []
        with open(legacy, encoding="utf-8") as fh:
            manifest = json.load(fh)
        folder = os.path.dirname(legacy)
        out = []
        for m in manifest:
            with open(os.path.join(folder, m["file"]), "rb") as fh:
                out.append(Attachment(filename=m["filename"], content_type=m["content_type"], data=fh.read()))
        return out
    manifest = json.loads(store.read_bytes(key))
    return [Attachment(filename=m["filename"], content_type=m["content_type"],
                       data=store.read_bytes(f"{_pending_prefix(message_id)}{m['file']}")) for m in manifest]


def drop_attachments(message_id: str) -> None:
    get_storage().delete_prefix(_pending_prefix(message_id))
    shutil.rmtree(os.path.join(settings.STORAGE_DIR, "pending", message_id), ignore_errors=True)


# ---------------------------------------------------------------- suppression
def suppress(db, user_id: str, email: str, reason: str, detail: str = "", message_id: str | None = None) -> None:
    email = email.strip().lower()
    exists = db.scalar(select(Suppression).where(Suppression.user_id == user_id, Suppression.email == email))
    if not exists:
        db.add(Suppression(user_id=user_id, email=email, reason=reason, detail=detail[:500], message_id=message_id))


def suppressed_set(db, user_id: str, emails: list[str]) -> set[str]:
    lowered = [e.lower() for e in emails]
    if not lowered:
        return set()
    rows = db.scalars(
        select(Suppression.email).where(Suppression.user_id == user_id, Suppression.email.in_(lowered))
    ).all()
    return set(rows)


# ---------------------------------------------------------------- processing
def _notify(user_id: str, event: str, data: dict, message_id: str) -> None:
    def run():
        db = SessionLocal()
        try:
            webhooks.dispatch(db, user_id, event, data, message_id)
        except Exception:  # never let a webhook crash delivery
            log.exception("webhook dispatch failed")
        finally:
            db.close()

    if _webhook_pool is not None:
        _webhook_pool.submit(run)
    else:
        run()


def process_message(message_id: str) -> None:
    """Deliver one queued email (safe to call from several workers at once)."""
    from app.services.delivery import public_view  # local import avoids a cycle

    db = SessionLocal()
    try:
        now = utcnow()
        claimed = db.execute(
            update(EmailMessage)
            .where(
                EmailMessage.id == message_id,
                EmailMessage.status == "queued",
                or_(EmailMessage.next_attempt_at.is_(None), EmailMessage.next_attempt_at <= now),
            )
            .values(status="sending", attempts=EmailMessage.attempts + 1, next_attempt_at=now)
        ).rowcount
        db.commit()
        if not claimed:
            return
        msg = db.get(EmailMessage, message_id)
        db.refresh(msg)

        # Skip addresses that bounced or complained before (protects your sender reputation)
        blocked = suppressed_set(db, msg.user_id, msg.to + msg.cc + msg.bcc)
        to = [e for e in msg.to if e.lower() not in blocked]
        cc = [e for e in msg.cc if e.lower() not in blocked]
        bcc = [e for e in msg.bcc if e.lower() not in blocked]
        msg.suppressed = sorted(blocked)
        if not to:
            msg.status = "failed"
            msg.error = "Not sent: every recipient is on your suppression list (they bounced or marked you as spam before)."
            db.commit()
            drop_attachments(msg.id)
            _notify(msg.user_id, "email.failed", public_view(msg), msg.id)
            return

        event = "email.sent"
        try:
            mime = providers.build_mime(
                from_email=msg.from_email,
                from_name=msg.from_name,
                to=to,
                cc=cc,
                reply_to=msg.reply_to,
                subject=msg.subject,
                html=msg.html,
                text=msg.text,
                attachments=load_attachments(msg.id),
                message_id=msg.id,
            )
            msg.provider_message_id = providers.send(mime, to + cc + bcc)
            msg.status, msg.error, msg.sent_at = "sent", None, utcnow()
        except providers.PartialDelivery as part:
            msg.provider_message_id = part.provider_id
            msg.status, msg.sent_at = "sent", utcnow()
            msg.error = "Some recipients bounced: " + "; ".join(f"{k}: {v}" for k, v in part.bounced.items())
            for addr, why in part.bounced.items():
                suppress(db, msg.user_id, addr, "bounce", why, msg.id)
        except providers.ProviderError as exc:
            for addr, why in exc.bounced.items():
                suppress(db, msg.user_id, addr, "bounce", why, msg.id)
            if exc.temporary and msg.attempts < settings.MAX_DELIVERY_ATTEMPTS:
                wait = BACKOFF_MINUTES[min(msg.attempts - 1, len(BACKOFF_MINUTES) - 1)]
                msg.status = "queued"
                msg.next_attempt_at = utcnow() + timedelta(minutes=wait)
                msg.error = f"{exc} Attempt {msg.attempts} of {settings.MAX_DELIVERY_ATTEMPTS}; next try in {wait} min."
                db.commit()
                return
            msg.status, msg.error, event = "failed", str(exc), "email.failed"
        except Exception as exc:  # unexpected bug: fail visibly, never leave it stuck
            log.exception("unexpected delivery error for %s", msg.id)
            msg.status, msg.error, event = "failed", f"Unexpected error: {exc.__class__.__name__}", "email.failed"

        db.commit()
        drop_attachments(msg.id)
        _notify(msg.user_id, event, public_view(msg), msg.id)
    finally:
        db.close()


def process_due(limit: int = 25) -> int:
    db = SessionLocal()
    try:
        now = utcnow()
        # Recover emails left in "sending" by a crashed process
        db.execute(
            update(EmailMessage)
            .where(EmailMessage.status == "sending", EmailMessage.next_attempt_at < now - timedelta(minutes=STUCK_AFTER_MINUTES))
            .values(status="queued")
        )
        db.commit()
        ids = db.scalars(
            select(EmailMessage.id)
            .where(EmailMessage.status == "queued", or_(EmailMessage.next_attempt_at.is_(None), EmailMessage.next_attempt_at <= now))
            .order_by(EmailMessage.created_at)
            .limit(limit)
        ).all()
    finally:
        db.close()
    for mid in ids:
        process_message(mid)
    return len(ids)


# ---------------------------------------------------------------- housekeeping
def cleanup_expired() -> None:
    """Delete expired download-link files and old one-time codes."""
    db = SessionLocal()
    try:
        now = utcnow()
        for f in db.scalars(select(StoredFile).where(StoredFile.expires_at < now).limit(500)).all():
            try:
                if os.path.isabs(f.path):  # saved by an older version, on this server's disk
                    os.remove(f.path)
                else:
                    get_storage().delete(f.path)
            except (FileNotFoundError, OSError):
                pass
            db.delete(f)
        for c in db.scalars(select(AuthCode).where(AuthCode.expires_at < now - timedelta(days=1)).limit(1000)).all():
            db.delete(c)
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------- worker thread
def _loop() -> None:
    import time

    log.info("ThumbsUp delivery worker started")
    last_cleanup = 0.0
    while not _stop.is_set():
        try:
            while process_due():
                pass
            if time.monotonic() - last_cleanup > 3600:
                cleanup_expired()
                last_cleanup = time.monotonic()
        except Exception:
            log.exception("delivery worker error")
        _wake.wait(settings.WORKER_POLL_SECONDS)
        _wake.clear()


def start_worker() -> None:
    global _thread, _webhook_pool
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _webhook_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="thumbsup-webhooks")
    _thread = threading.Thread(target=_loop, name="thumbsup-worker", daemon=True)
    _thread.start()


def stop_worker() -> None:
    global _webhook_pool
    _stop.set()
    _wake.set()
    if _thread:
        _thread.join(timeout=10)
    if _webhook_pool:
        _webhook_pool.shutdown(wait=False)
        _webhook_pool = None


def worker_running() -> bool:
    return bool(_thread and _thread.is_alive())


def enqueue(background, message_id: str) -> None:
    """Wake the worker; if no worker runs (tests), deliver right after the response."""
    if worker_running():
        _wake.set()
    else:
        background.add_task(process_message, message_id)
