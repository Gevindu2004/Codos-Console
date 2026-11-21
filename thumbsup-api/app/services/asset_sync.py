"""Keeps ThumbsUp's copy of each customer folder in step with Google Drive.

How changes are noticed (fastest first):
  1. Google push notifications (production, HTTPS): Google calls us the moment a file changes.
  2. Change-feed check every few seconds: one cheap API call tells us which files changed.
  3. Full safety re-scan of every folder (ASSET_POLL_SECONDS), in case anything was missed.
A change marks the project "sync requested"; the worker then re-reads that folder.
"""

import hashlib
import hmac
import logging
import os
import re
import tempfile
import threading
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update

from app.config import settings
from app.db import SessionLocal
from app.models import AssetEvent, AssetFile, AssetProject, AssetUsage, SystemState
from app.services import drive
from app.services.asset_storage import get_storage
from app.services.files import BLOCKED_EXTENSIONS

log = logging.getLogger("thumbsup.assets")

MAX_DEPTH = 8
CHANGE_CHECK_SECONDS = 15
SYNC_STUCK_MINUTES = 30
WATCH_DAYS = 6  # Google allows up to 7 days for change channels; we renew before that

_wake = threading.Event()
_stop = threading.Event()
_thread: threading.Thread | None = None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def etag_for(file_id: str, version: str) -> str:
    return hashlib.sha256(f"{file_id}:{version}".encode()).hexdigest()[:24]


def blob_prefix(project_id: str, drive_file_id: str, etag: str) -> str:
    return f"{project_id}/{drive_file_id}/{etag}"


def event(db, project: AssetProject, kind: str, path: str = "", message: str = "") -> None:
    db.add(AssetEvent(project_id=project.id, user_id=project.user_id, kind=kind, path=path[:1000], message=message[:500]))


VERIFY_PREFIX = "thumbsup-verify-"


def verification_name(user_id: str) -> str:
    """Per-account file name that proves a folder is yours: only people who can ADD files to the
    folder can create it, so knowing a private folder's link is not enough to publish it."""
    return VERIFY_PREFIX + hmac.new(settings.JWT_SECRET.encode(), f"verify:{user_id}".encode(), hashlib.sha256).hexdigest()[:10]


def _stem(name: str) -> str:
    return os.path.splitext(name)[0].strip().lower()


_COPY_SUFFIX = re.compile(r"^(?P<base>.+?) \(\d+\)(?P<ext>\.[^.]+)?$")


# ---------------------------------------------------------------- sync one project
def sync_project(project_id: str, client=None) -> bool:
    """Bring one project up to date. Returns False if another worker already runs it."""
    db = SessionLocal()
    try:
        now = utcnow()
        claimed = db.execute(
            update(AssetProject)
            .where(
                AssetProject.id == project_id,
                or_(AssetProject.sync_started_at.is_(None), AssetProject.sync_started_at < now - timedelta(minutes=SYNC_STUCK_MINUTES)),
            )
            .values(sync_started_at=now, sync_requested=False)
        ).rowcount
        db.commit()
        if not claimed:
            return False
        project = db.get(AssetProject, project_id)
        try:
            _sync(db, project, client or drive.get_client())
        except drive.DriveAccessError as exc:
            db.rollback()
            project = db.get(AssetProject, project_id)
            if project.status != "no_access":
                event(db, project, "access_lost", "", "ThumbsUp can't open the Drive folder anymore. Files keep being served "
                      "from the last copy. Share the folder with the ThumbsUp robot again to resume updates.")
            project.status, project.last_error = "no_access", str(exc)
        except drive.DriveError as exc:
            db.rollback()
            project = db.get(AssetProject, project_id)
            project.last_error = str(exc)
            if project.status == "syncing":
                project.status = "error"
            if exc.temporary:
                project.sync_requested = True
        except Exception as exc:  # noqa: BLE001 - never crash the worker
            log.exception("asset sync failed for %s", project_id)
            db.rollback()
            project = db.get(AssetProject, project_id)
            project.last_error = f"Unexpected error: {exc.__class__.__name__}"
            if project.status == "syncing":
                project.status = "error"
        project.sync_started_at = None
        project.last_synced_at = utcnow()
        db.commit()
        return True
    finally:
        db.close()


def _list_tree(client, root_id: str) -> tuple[list[tuple[drive.DriveFile, str]], list[str], bool]:
    """Walk the folder and its subfolders. Returns ([(file, path)], folder_ids, truncated)."""
    files, folder_ids = [], [root_id]
    queue = [(root_id, "", 0)]
    truncated = False
    while queue:
        folder_id, prefix, depth = queue.pop(0)
        for item in client.list_children(folder_id):
            if item.is_folder:
                if depth + 1 <= MAX_DEPTH:
                    folder_ids.append(item.id)
                    queue.append((item.id, f"{prefix}{item.name}/", depth + 1))
                continue
            if len(files) >= settings.ASSET_MAX_FILES:
                truncated = True
                continue
            files.append((item, f"{prefix}{item.name}"))
    return files, folder_ids, truncated


def _sync(db, project: AssetProject, client) -> None:
    root = client.get(project.folder_id)
    if not root.is_folder:
        raise drive.DriveError("This link points to a file, not a folder.")
    project.folder_name = root.name
    listed, folder_ids, truncated = _list_tree(client, project.folder_id)

    # Ownership proof: this account's verification file in the folder's top level
    expected = verification_name(project.user_id)
    if project.verified_at is None and any("/" not in path and _stem(f.name) == expected for f, path in listed):
        other = db.scalar(select(AssetProject).where(AssetProject.folder_id == project.folder_id,
                                                     AssetProject.id != project.id, AssetProject.verified_at.is_not(None)))
        if other is None:
            project.verified_at = now_ = utcnow()
            event(db, project, "verified", "", "Folder ownership confirmed. Files are now live. You can delete the verification file.")
            del now_
    # Verification files are never published
    listed = [(f, path) for f, path in listed if not _stem(f.name).startswith(VERIFY_PREFIX)]
    storage = get_storage()
    max_bytes = settings.ASSET_MAX_FILE_MB * 1024 * 1024
    now = utcnow()

    rows = {r.drive_file_id: r for r in db.scalars(select(AssetFile).where(AssetFile.project_id == project.id)).all()}
    removed_by_key = {r.path_key: r for r in rows.values() if r.status == "removed"}
    active_keys_before = {r.path_key for r in rows.values() if r.status == "active"}
    seen: set[str] = set()
    to_delete_blobs: list[str] = []
    touched_keys: set[str] = set()
    new_files: list[tuple[str, str, str]] = []

    for f, path in listed:
        seen.add(f.id)
        row = rows.get(f.id)
        path_key = path.lower()
        export_format = drive.GOOGLE_EXPORTS[f.mime_type][0] if f.is_google_doc else None
        ext = os.path.splitext(f.name)[1].lower()

        if row is None:
            row = AssetFile(project_id=project.id, user_id=project.user_id, drive_file_id=f.id, path=path,
                            path_key=path_key, mime_type=f.mime_type, drive_version="", status="active")
            db.add(row)
            rows[f.id] = row
            is_new = True
        else:
            is_new = False
        old_path, old_status, old_key = row.path, row.status, row.storage_key
        renamed = not is_new and row.path != path
        row.path, row.path_key, row.modified_at, row.export_format = path, path_key, f.modified_at, export_format

        # Files we refuse to serve
        if ext in BLOCKED_EXTENSIONS and not f.is_google_doc:
            if row.status != "blocked":
                event(db, project, "blocked", path, f"{ext} files can harm visitors' computers, so ThumbsUp won't serve them.")
            row.status, row.error, row.storage_key, row.drive_version = "blocked", f"{ext} files are not allowed", None, f.version
            row.mime_type, row.size = f.mime_type, f.size
            if old_key:
                to_delete_blobs.append(old_key.rsplit("/", 1)[0])
            continue
        if f.size > max_bytes:
            if row.status != "too_large":
                event(db, project, "too_large", path, f"Bigger than the {settings.ASSET_MAX_FILE_MB} MB limit per file.")
            row.status, row.error, row.size, row.drive_version = "too_large", "File too large", f.size, f.version
            continue

        needs_copy = is_new or row.drive_version != f.version or row.status != "active" or not row.storage_key
        if needs_copy:
            etag = etag_for(f.id, f.version)
            prefix = blob_prefix(project.id, f.id, etag)
            fd, tmp = tempfile.mkstemp(prefix="tu-asset-")
            os.close(fd)
            try:
                content_type, size = client.download(f, tmp, max_bytes)
                storage.put_file(f"{prefix}/original", tmp, content_type)
            except drive.DriveAccessError as exc:
                row.status, row.error = "error", f"Couldn't download: {exc}"
                event(db, project, "error", path, row.error)
                continue
            except drive.DriveError as exc:
                if exc.temporary:
                    raise
                row.status, row.error = "error", str(exc)
                event(db, project, "error", path, str(exc))
                continue
            finally:
                if os.path.exists(tmp):
                    os.remove(tmp)
            if old_key and not old_key.startswith(prefix):
                to_delete_blobs.append(old_key.rsplit("/", 1)[0])
            row.storage_key, row.etag, row.mime_type, row.size = f"{prefix}/original", etag, content_type, size
            row.drive_version, row.status, row.error, row.removed_at, row.synced_at = f.version, "active", None, None, now
            touched_keys.add(path_key)

            if is_new:
                new_files.append((path, path_key, f.name))
            elif old_status == "removed":
                event(db, project, "restored", path, "File is back.")
            else:
                event(db, project, "updated", path, "New version is live.")
        elif renamed:
            touched_keys.add(path_key)
        if renamed:
            event(db, project, "renamed", path, f"Renamed from {old_path}. The old link stops working; use the new name.")

    # Classify new files now that we know what disappeared
    gone_keys = {r.path_key for r in rows.values() if r.drive_file_id not in seen and r.status == "active"}
    for path, path_key, name in new_files:
        if path_key in removed_by_key or path_key in gone_keys:
            event(db, project, "replaced", path, f"{path} now shows the new file.")
            continue
        event(db, project, "added", path, "New file is live.")
        hint = _COPY_SUFFIX.match(name)
        if hint:
            intended = (path[: len(path) - len(name)] + hint.group("base") + (hint.group("ext") or "")).lower()
            if intended in removed_by_key or intended in gone_keys or intended in active_keys_before:
                event(db, project, "hint", path, f"Did you mean to name it \"{os.path.basename(intended)}\"? "
                      "Drive added a number because a file with that name existed. Rename it to replace the old one.")

    # Files that disappeared from Drive: keep serving them for a grace time
    for r in rows.values():
        if r.drive_file_id not in seen and r.status != "removed":
            if r.status == "active" and r.path_key not in {k for _, k, _ in new_files}:
                event(db, project, "removed", r.path, f"Deleted in Drive. Still served for {settings.ASSET_DELETE_GRACE_MINUTES} "
                      "min, so you can upload a replacement with the same name.")
            r.status, r.removed_at = "removed", now

    # Purge: grace time over, or a replacement with the same name is live
    active_keys_now = {r.path_key for r in rows.values() if r.status == "active"}
    grace = timedelta(minutes=settings.ASSET_DELETE_GRACE_MINUTES)
    for r in list(rows.values()):
        if r.status == "removed" and (aware(r.removed_at) < now - grace or r.path_key in active_keys_now):
            if r.storage_key:
                to_delete_blobs.append(r.storage_key.rsplit("/", 1)[0])
            db.delete(r)
            rows.pop(r.drive_file_id, None)

    # Two files with the same name: newest wins, but tell the developer
    by_key = defaultdict(list)
    for r in rows.values():
        if r.status == "active":
            by_key[r.path_key].append(r)
    for key, group in by_key.items():
        if len(group) > 1 and key in touched_keys:
            event(db, project, "conflict", group[0].path, f"{len(group)} files are named \"{group[0].path}\". "
                  "The newest one is shown. Delete or rename the others in Drive.")

    if truncated:
        event(db, project, "error", "", f"The folder has more than {settings.ASSET_MAX_FILES} files; only the first ones are served.")

    live = [r for r in rows.values() if r.status in ("active", "removed")]
    project.folder_ids = folder_ids
    project.file_count = len([r for r in live if r.status == "active"])
    project.total_bytes = sum(r.size for r in live)
    if project.status == "no_access":
        event(db, project, "access_restored", "", "ThumbsUp can open the folder again. Updates resumed.")
    if project.verified_at is None:
        if project.status != "needs_verification":
            event(db, project, "needs_verification", "", f"Add a file named \"{expected}\" to the folder to prove it's "
                  "yours. Until then nothing is public.")
        project.status = "needs_verification"
    else:
        project.status = "active"
    project.last_error = None
    db.commit()

    storage_ = get_storage()
    for prefix in set(to_delete_blobs):
        try:
            storage_.delete_prefix(prefix)
        except Exception:  # noqa: BLE001
            log.warning("could not delete old blob %s", prefix)


# ---------------------------------------------------------------- Google change feed
def push_token() -> str:
    if settings.DRIVE_PUSH_TOKEN:
        return settings.DRIVE_PUSH_TOKEN
    return hmac.new(settings.JWT_SECRET.encode(), b"drive-push", hashlib.sha256).hexdigest()


def _state(db, key: str) -> SystemState:
    row = db.get(SystemState, key)
    if row is None:
        row = SystemState(key=key, value={})
        db.add(row)
        db.flush()
    return row


def check_changes(client=None) -> int:
    """Read Google's change feed and flag the projects whose folders changed."""
    client = client or drive.get_client()
    db = SessionLocal()
    try:
        state = _state(db, "drive_changes")
        value = dict(state.value or {})
        if not value.get("page_token"):
            value["page_token"] = client.start_page_token()
            state.value = value
            db.commit()
            return 0
        changes, new_token = client.list_changes(value["page_token"])
        flagged = 0
        if changes:
            projects = db.scalars(select(AssetProject)).all()
            file_owner = dict(db.execute(select(AssetFile.drive_file_id, AssetFile.project_id)).all())
            for p in projects:
                folders = set(p.folder_ids or [p.folder_id])
                for c in changes:
                    if c["fileId"] in folders or file_owner.get(c["fileId"]) == p.id or folders.intersection(c["parents"]):
                        if not p.sync_requested:
                            p.sync_requested = True
                            flagged += 1
                        break
        value["page_token"] = new_token
        value["pending"] = False
        state.value = value
        db.commit()
        return flagged
    finally:
        db.close()


def ensure_watch(client=None) -> None:
    """Ask Google to call us on every change (needs a public HTTPS address)."""
    if not settings.PUBLIC_BASE_URL.startswith("https://"):
        return
    client = client or drive.get_client()
    db = SessionLocal()
    try:
        state = _state(db, "drive_changes")
        value = dict(state.value or {})
        expires = value.get("watch_expires_ms", 0)
        if expires and expires / 1000 > (utcnow() + timedelta(days=1)).timestamp():
            return
        if not value.get("page_token"):
            value["page_token"] = client.start_page_token()
        if value.get("channel_id") and value.get("resource_id"):
            client.stop_channel(value["channel_id"], value["resource_id"])
        channel_id = str(uuid.uuid4())
        expiration = int((utcnow() + timedelta(days=WATCH_DAYS)).timestamp() * 1000)
        resp = client.watch_changes(
            value["page_token"], channel_id, f"{settings.PUBLIC_BASE_URL.rstrip('/')}/v1/providers/google/drive",
            push_token(), expiration,
        )
        value.update(channel_id=channel_id, resource_id=resp.get("resourceId"), watch_expires_ms=int(resp.get("expiration", expiration)))
        state.value = value
        db.commit()
        log.info("Google Drive push notifications active until %s", value["watch_expires_ms"])
    except drive.DriveError as exc:
        log.warning("could not start Google Drive push notifications: %s", exc)
    finally:
        db.close()


def notification_received(channel_id: str | None, token: str | None) -> bool:
    if not token or not hmac.compare_digest(token, push_token()):
        return False
    db = SessionLocal()
    try:
        state = _state(db, "drive_changes")
        value = dict(state.value or {})
        if value.get("channel_id") and channel_id != value["channel_id"]:
            return False
        value["pending"] = True
        state.value = value
        db.commit()
    finally:
        db.close()
    _wake.set()
    return True


def request_sync(project_id: str) -> None:
    db = SessionLocal()
    try:
        db.execute(update(AssetProject).where(AssetProject.id == project_id).values(sync_requested=True))
        db.commit()
    finally:
        db.close()
    _wake.set()


def due_projects(limit: int = 10) -> list[str]:
    db = SessionLocal()
    try:
        cutoff = utcnow() - timedelta(seconds=settings.ASSET_POLL_SECONDS)
        return list(
            db.scalars(
                select(AssetProject.id)
                .where(
                    AssetProject.sync_started_at.is_(None),
                    or_(AssetProject.sync_requested.is_(True), AssetProject.last_synced_at.is_(None), AssetProject.last_synced_at < cutoff),
                )
                .order_by(AssetProject.sync_requested.desc(), AssetProject.last_synced_at)
                .limit(limit)
            ).all()
        )
    finally:
        db.close()


# ---------------------------------------------------------------- usage counters
_usage_lock = threading.Lock()
_usage: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])


def count_hit(project_id: str, nbytes: int) -> None:
    day = utcnow().strftime("%Y-%m-%d")
    with _usage_lock:
        rec = _usage[(project_id, day)]
        rec[0] += 1
        rec[1] += max(0, nbytes)


def flush_usage() -> None:
    with _usage_lock:
        pending = dict(_usage)
        _usage.clear()
    if not pending:
        return
    db = SessionLocal()
    try:
        for (pid, day), (hits, nbytes) in pending.items():
            row = db.scalar(select(AssetUsage).where(AssetUsage.project_id == pid, AssetUsage.day == day))
            if row is None:
                if db.get(AssetProject, pid) is None:
                    continue
                row = AssetUsage(project_id=pid, day=day, hits=0, bytes_served=0)
                db.add(row)
            row.hits += hits
            row.bytes_served += nbytes
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------- worker thread
def _loop() -> None:
    log.info("ThumbsUp Drive Assets worker started")
    last_change_check = 0.0
    last_watch_check = 0.0
    import time

    while not _stop.is_set():
        try:
            now = time.monotonic()
            if now - last_watch_check > 3600:
                ensure_watch()
                last_watch_check = now
            if now - last_change_check > CHANGE_CHECK_SECONDS or _pending_notification():
                check_changes()
                last_change_check = now
            for pid in due_projects():
                if _stop.is_set():
                    break
                sync_project(pid)
            flush_usage()
        except drive.DriveError as exc:
            log.warning("Drive Assets worker: %s", exc)
        except Exception:  # noqa: BLE001
            log.exception("Drive Assets worker error")
        _wake.wait(3)
        _wake.clear()


def _pending_notification() -> bool:
    db = SessionLocal()
    try:
        row = db.get(SystemState, "drive_changes")
        return bool(row and (row.value or {}).get("pending"))
    finally:
        db.close()


def start_worker() -> None:
    global _thread
    if not settings.drive_configured or (_thread and _thread.is_alive()):
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="thumbsup-assets", daemon=True)
    _thread.start()


def stop_worker() -> None:
    _stop.set()
    _wake.set()
    if _thread:
        _thread.join(timeout=10)
    flush_usage()


def worker_running() -> bool:
    return bool(_thread and _thread.is_alive())


def wake() -> None:
    _wake.set()
