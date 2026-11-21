"""File rules: safe names, blocked types, size limits, and big-file download links."""

import mimetypes
import os
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.deps import ApiError
from app.models import StoredFile

# Files that can run code on the receiver's computer are never accepted.
BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".pif", ".msi", ".msp", ".vbs", ".vbe", ".js", ".jse",
    ".ws", ".wsf", ".wsh", ".ps1", ".psm1", ".hta", ".cpl", ".jar", ".lnk", ".reg", ".dll", ".sys",
    ".apk", ".app", ".dmg", ".sh", ".iso",
}

MB = 1024 * 1024


@dataclass
class Attachment:
    filename: str
    content_type: str
    data: bytes


def safe_filename(name: str) -> str:
    name = os.path.basename((name or "file").replace("\\", "/"))
    name = re.sub(r"[^\w.\- ()]+", "_", name).strip(" .") or "file"
    return name[:150]


def validate_attachment(filename: str, content_type: str | None, data: bytes) -> Attachment:
    clean = safe_filename(filename)
    ext = os.path.splitext(clean)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        raise ApiError(
            422,
            "file_type_blocked",
            f"'{clean}' can't be sent: {ext} files can harm computers, so they're blocked.",
            hint="Zip it or send a document, image, or PDF instead.",
        )
    if len(data) == 0:
        raise ApiError(422, "empty_file", f"'{clean}' is empty.")
    if len(data) > settings.MAX_FILE_MB * MB:
        raise ApiError(
            413,
            "file_too_large",
            f"'{clean}' is {len(data) / MB:.1f} MB. The maximum per file is {settings.MAX_FILE_MB} MB.",
        )
    ctype = content_type or mimetypes.guess_type(clean)[0] or "application/octet-stream"
    return Attachment(filename=clean, content_type=ctype, data=data)


def split_inline_and_links(files: list[Attachment]) -> tuple[list[Attachment], list[Attachment]]:
    """Keep small files as normal attachments; large ones become secure download links.

    Many inboxes reject emails over ~10-25 MB, so instead of failing we switch big files
    to links automatically.
    """
    budget = settings.MAX_INLINE_ATTACHMENTS_MB * MB
    inline, links, used = [], [], 0
    for f in sorted(files, key=lambda a: len(a.data)):
        if used + len(f.data) <= budget:
            inline.append(f)
            used += len(f.data)
        else:
            links.append(f)
    return inline, links


def store_for_download(db: Session, user_id: str, message_id: str, f: Attachment) -> StoredFile:
    from app.services.asset_storage import get_storage

    # Shared storage (Azure Blob / S3 / disk): any server copy can serve the download.
    # Never the visitor's file name in the key.
    path = f"email/files/{user_id}/{secrets.token_hex(16)}"
    get_storage().put_bytes(path, f.data, f.content_type)
    stored = StoredFile(
        user_id=user_id,
        message_id=message_id,
        filename=f.filename,
        content_type=f.content_type,
        size=len(f.data),
        path=path,
        download_token=secrets.token_urlsafe(32),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.DOWNLOAD_LINK_DAYS),
    )
    db.add(stored)
    return stored


def download_url(stored: StoredFile) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/v1/files/{stored.download_token}"


def human_size(size: int) -> str:
    if size >= MB:
        return f"{size / MB:.1f} MB"
    return f"{max(1, size // 1024)} KB"
