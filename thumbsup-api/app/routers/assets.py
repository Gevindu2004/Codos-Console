"""Drive Assets: serve files from a customer's Google Drive folder by name.

  Dashboard   /dashboard/assets/...            (login cookie)
  Developer   /v1/assets/...                   (secret API key)
  Public      GET /a/{project-slug}/{file path} (no key: it's what websites embed)
  Google      POST /v1/providers/google/drive  (change notifications)
"""

import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, unquote

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import ApiError, client_ip, enforce_rate, get_current_user, get_secret_key
from app.models import ApiKey, AssetEvent, AssetFile, AssetProject, AssetUsage, User
from app.routers.common import get_owned
from app.services import asset_sync, drive, images
from app.services.asset_storage import get_storage

dashboard = APIRouter(prefix="/dashboard/assets", tags=["Dashboard: Drive Assets"])
developer = APIRouter(prefix="/v1/assets", tags=["Drive Assets API"])
public = APIRouter(tags=["Drive Assets: public files"])

SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$")
RESERVED_SLUGS = {"api", "admin", "assets", "static", "dashboard", "docs", "health", "v1", "www", "thumbsup", "viacodos"}


# ---------------------------------------------------------------- helpers
def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:50].strip("-") or "site"


def base_url(p: AssetProject) -> str:
    return f"{settings.assets_base_url}/a/{p.slug}/"


def file_url(p: AssetProject, path: str) -> str:
    return base_url(p) + quote(path)


def project_view(p: AssetProject) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "base_url": base_url(p),
        "folder_id": p.folder_id,
        "folder_name": p.folder_name,
        "folder_link": f"https://drive.google.com/drive/folders/{p.folder_id}",
        "status": p.status,
        "verified": p.verified_at is not None,
        "verification_file": asset_sync.verification_name(p.user_id),
        "syncing": p.sync_started_at is not None or p.sync_requested,
        "last_error": p.last_error,
        "file_count": p.file_count,
        "total_bytes": p.total_bytes,
        "last_synced_at": p.last_synced_at,
        "created_at": p.created_at,
    }


def file_view(p: AssetProject, f: AssetFile) -> dict:
    grace_ends = None
    if f.status == "removed" and f.removed_at:
        grace_ends = asset_sync.aware(f.removed_at) + timedelta(minutes=settings.ASSET_DELETE_GRACE_MINUTES)
    return {
        "id": f.id,
        "path": f.path,
        "url": file_url(p, f.path),
        "mime_type": f.mime_type,
        "size": f.size,
        "status": f.status,
        "error": f.error,
        "is_google_doc": bool(f.export_format),
        "is_image": f.mime_type in images.RESIZABLE,
        "modified_at": f.modified_at,
        "synced_at": f.synced_at,
        "grace_ends_at": grace_ends,
    }


def _kick(background: BackgroundTasks, project_id: str) -> None:
    """Sync now: wake the worker, or (no worker, e.g. tests) run after the response."""
    if asset_sync.worker_running():
        asset_sync.request_sync(project_id)
    else:
        background.add_task(asset_sync.sync_project, project_id)


def _require_drive() -> None:
    if not settings.drive_configured:
        raise ApiError(
            503,
            "drive_not_configured",
            "Drive Assets isn't set up on this server yet.",
            hint="The server admin adds a Google service account key (GOOGLE_SERVICE_ACCOUNT_FILE) in thumbsup-api/.env.",
        )


# ---------------------------------------------------------------- dashboard
class ProjectIn(BaseModel):
    folder_link: str = Field(min_length=10, max_length=500)
    name: str = Field(default="", max_length=120)
    slug: str = Field(default="", max_length=60)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=60)


def _check_slug(db: Session, slug: str, exclude_id: str | None = None) -> str:
    slug = slug.strip().lower()
    if not SLUG_RE.match(slug) or slug in RESERVED_SLUGS:
        raise ApiError(422, "invalid_slug", "Use 3-50 lowercase letters, numbers and dashes, like acme-shop.")
    taken = db.scalar(select(AssetProject).where(AssetProject.slug == slug))
    if taken and taken.id != exclude_id:
        raise ApiError(409, "slug_taken", f"The address '{slug}' is already used. Try another one.")
    return slug


@dashboard.get("/config")
def config(user: User = Depends(get_current_user)):
    return {
        "configured": settings.drive_configured,
        "robot_email": drive.service_account_email(),
        "verification_file": asset_sync.verification_name(user.id),
        "assets_base_url": settings.assets_base_url,
        "max_file_mb": settings.ASSET_MAX_FILE_MB,
        "grace_minutes": settings.ASSET_DELETE_GRACE_MINUTES,
        "cache_seconds": settings.ASSET_CACHE_SECONDS,
    }


@dashboard.get("/projects")
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(AssetProject).where(AssetProject.user_id == user.id).order_by(AssetProject.created_at.desc())).all()
    return {"data": [project_view(p) for p in rows]}


@dashboard.post("/projects", status_code=201)
def create_project(body: ProjectIn, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_drive()
    folder_id = drive.parse_folder_id(body.folder_link)
    if not folder_id:
        raise ApiError(422, "invalid_link", "That doesn't look like a Google Drive folder link.",
                       hint="Open the folder in Drive and copy the address, like https://drive.google.com/drive/folders/1AbC...")
    mine = db.scalar(select(AssetProject).where(AssetProject.folder_id == folder_id, AssetProject.user_id == user.id))
    if mine:
        raise ApiError(409, "already_connected", f"You already connected this folder as '{mine.name}'.")
    taken = db.scalar(select(AssetProject).where(AssetProject.folder_id == folder_id, AssetProject.verified_at.is_not(None)))
    if taken:
        raise ApiError(409, "folder_taken", "This folder is already connected and verified by another ThumbsUp account.")
    robot = drive.service_account_email()
    try:
        folder = drive.get_client().get(folder_id)
    except drive.DriveAccessError:
        raise ApiError(
            422,
            "folder_not_shared",
            "ThumbsUp can't open this folder yet.",
            hint=f"In Google Drive, share the folder with {robot} as Viewer, then try again.",
        )
    except drive.DriveError as exc:
        raise ApiError(502, "drive_error", str(exc))
    if not folder.is_folder:
        raise ApiError(422, "not_a_folder", "This link is a single file. Share and paste the link of the folder instead.")

    name = (body.name or folder.name).strip()[:120] or "My website"
    slug = _check_slug(db, body.slug) if body.slug else _unique_slug(db, slugify(name))
    p = AssetProject(user_id=user.id, name=name, slug=slug, folder_id=folder_id, folder_name=folder.name,
                     folder_ids=[folder_id], status="syncing", sync_requested=True)
    db.add(p)
    db.commit()
    _kick(background, p.id)
    return {"data": project_view(p)}


def _unique_slug(db: Session, base: str) -> str:
    base = base if len(base) >= 3 else f"{base}-site"
    if base in RESERVED_SLUGS:
        base = f"{base}-site"
    candidate, n = base, 2
    while db.scalar(select(AssetProject).where(AssetProject.slug == candidate)):
        candidate, n = f"{base[:45]}-{n}", n + 1
    return candidate


@dashboard.get("/projects/{project_id}")
def get_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"data": project_view(get_owned(db, AssetProject, project_id, user))}


@dashboard.patch("/projects/{project_id}")
def update_project(project_id: str, body: ProjectUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_owned(db, AssetProject, project_id, user)
    if body.name is not None:
        p.name = body.name.strip()
    if body.slug is not None and body.slug != p.slug:
        p.slug = _check_slug(db, body.slug, exclude_id=p.id)
    db.commit()
    return {"data": project_view(p)}


@dashboard.delete("/projects/{project_id}")
def delete_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_owned(db, AssetProject, project_id, user)
    pid = p.id
    db.delete(p)
    db.commit()
    try:
        get_storage().delete_prefix(f"{pid}/")
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True}


@dashboard.post("/projects/{project_id}/sync", status_code=202)
def sync_now(project_id: str, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_owned(db, AssetProject, project_id, user)
    _require_drive()
    enforce_rate(f"assetsync:{p.id}", 6, "refresh requests")
    p.sync_requested = True
    db.commit()
    _kick(background, p.id)
    return {"data": project_view(p)}


@dashboard.get("/projects/{project_id}/files")
def project_files(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_owned(db, AssetProject, project_id, user)
    rows = db.scalars(select(AssetFile).where(AssetFile.project_id == p.id).order_by(AssetFile.path_key)).all()
    keys = [r.path_key for r in rows if r.status == "active"]
    duplicates = sorted({k for k in keys if keys.count(k) > 1})
    return {"data": [file_view(p, r) for r in rows], "duplicates": duplicates}


@dashboard.get("/projects/{project_id}/events")
def project_events(project_id: str, limit: int = Query(default=50, ge=1, le=200),
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_owned(db, AssetProject, project_id, user)
    rows = db.scalars(
        select(AssetEvent).where(AssetEvent.project_id == p.id, AssetEvent.user_id == user.id)
        .order_by(AssetEvent.created_at.desc()).limit(limit)
    ).all()
    return {"data": [{"id": e.id, "kind": e.kind, "path": e.path, "message": e.message, "created_at": e.created_at} for e in rows]}


@dashboard.get("/projects/{project_id}/usage")
def project_usage(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_owned(db, AssetProject, project_id, user)
    asset_sync.flush_usage()
    since = (datetime.now(timezone.utc) - timedelta(days=29)).strftime("%Y-%m-%d")
    rows = db.scalars(select(AssetUsage).where(AssetUsage.project_id == p.id, AssetUsage.day >= since)).all()
    by_day = {r.day: r for r in rows}
    days = [(datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(13, -1, -1)]
    return {
        "daily": [{"date": d, "hits": by_day[d].hits if d in by_day else 0,
                   "bytes": by_day[d].bytes_served if d in by_day else 0} for d in days],
        "last_30_days": {"hits": sum(r.hits for r in rows), "bytes": sum(r.bytes_served for r in rows)},
    }


# ---------------------------------------------------------------- developer API (secret key)
def _owned_project(db: Session, key: ApiKey, ref: str) -> AssetProject:
    p = db.get(AssetProject, ref) or db.scalar(select(AssetProject).where(AssetProject.slug == ref.lower()))
    if not p or p.user_id != key.user_id:
        raise ApiError(404, "project_not_found", f"No Drive Assets project '{ref}' in your account.")
    return p


@developer.get("/projects")
def api_projects(key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    rows = db.scalars(select(AssetProject).where(AssetProject.user_id == key.user_id).order_by(AssetProject.created_at)).all()
    return {"data": [project_view(p) for p in rows]}


@developer.get("/projects/{ref}/files")
def api_files(ref: str, key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    p = _owned_project(db, key, ref)
    rows = db.scalars(select(AssetFile).where(AssetFile.project_id == p.id, AssetFile.status == "active").order_by(AssetFile.path_key)).all()
    return {"project": project_view(p), "data": [file_view(p, r) for r in rows]}


@developer.post("/projects/{ref}/sync", status_code=202)
def api_sync(ref: str, background: BackgroundTasks, key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    p = _owned_project(db, key, ref)
    _require_drive()
    enforce_rate(f"assetsync:{p.id}", 6, "refresh requests")
    p.sync_requested = True
    db.commit()
    _kick(background, p.id)
    return {"ok": True, "project": project_view(p)}


@public.post("/v1/providers/google/drive", include_in_schema=False)
def google_drive_notification(request: Request):
    """Google calls this when something changes. We only note it; the worker does the work."""
    ok = asset_sync.notification_received(request.headers.get("x-goog-channel-id"), request.headers.get("x-goog-channel-token"))
    return Response(status_code=200 if ok else 404)


# ---------------------------------------------------------------- public files
SAFE_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"


def _resolve(db: Session, project: AssetProject, raw_path: str) -> AssetFile | None:
    key = unquote(raw_path).strip("/").lower()
    if not key or ".." in key.split("/"):
        return None
    grace_start = datetime.now(timezone.utc) - timedelta(minutes=settings.ASSET_DELETE_GRACE_MINUTES)

    def pick(rows):
        live = [r for r in rows if r.status == "active" and r.storage_key]
        if live:
            return max(live, key=lambda r: asset_sync.aware(r.modified_at) or datetime.min.replace(tzinfo=timezone.utc))
        grace = [r for r in rows if r.status == "removed" and r.storage_key and asset_sync.aware(r.removed_at) > grace_start]
        return max(grace, key=lambda r: asset_sync.aware(r.removed_at)) if grace else None

    base_q = select(AssetFile).where(AssetFile.project_id == project.id)
    found = pick(db.scalars(base_q.where(AssetFile.path_key == key)).all())
    if found:
        return found
    stem, dot, ext = key.rpartition(".")
    if dot and stem:  # "menu.pdf" for a Google Doc named "menu"
        doc = pick([r for r in db.scalars(base_q.where(AssetFile.path_key == stem)).all() if r.export_format == ext])
        if doc:
            return doc
    if "." not in key.rsplit("/", 1)[-1]:  # "hero" matches hero.jpg / hero.png ...
        candidates = [r for r in db.scalars(base_q.where(AssetFile.path_key.like(f"{key}.%"))).all()
                      if "/" not in r.path_key[len(key):]]
        images_first = [r for r in candidates if r.mime_type.startswith("image/")] or candidates
        return pick(images_first)
    return None


def _not_found(message: str, status: int = 404) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": "file_not_found", "message": message}},
                        headers={"Cache-Control": "public, max-age=10", "Access-Control-Allow-Origin": "*"})


def _headers(f: AssetFile, etag: str, filename: str) -> dict:
    risky = f.mime_type in ("text/html", "application/xhtml+xml", "image/svg+xml", "application/xml", "text/xml")
    disposition = "attachment" if f.mime_type in ("text/html", "application/xhtml+xml") else "inline"
    return {
        "ETag": f'"{etag}"',
        "Cache-Control": f"public, max-age={settings.ASSET_CACHE_SECONDS}, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": SAFE_CSP if risky else "sandbox",
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(filename)}",
        "Vary": "Accept",
    }


@public.head("/a/{slug}/{path:path}", include_in_schema=False)
@public.get("/a/{slug}/{path:path}")
def serve(slug: str, path: str, request: Request, db: Session = Depends(get_db)):
    project = db.scalar(select(AssetProject).where(AssetProject.slug == slug.lower()))
    if not project or project.verified_at is None:
        return _not_found("This asset project doesn't exist.")
    f = _resolve(db, project, path)
    if not f:
        return _not_found(f"No file named '{unquote(path)}' in this project. Check the exact name in the Drive folder.")

    filename = f.path.rsplit("/", 1)[-1] + (f".{f.export_format}" if f.export_format else "")
    try:
        opts = images.parse_options(request.query_params, request.headers.get("accept", ""), f.mime_type)
    except images.TransformError as exc:
        return JSONResponse(status_code=400, content={"error": {"code": "invalid_image_options", "message": str(exc)}})

    etag = f.etag + (("-" + images.variant_name(opts, f.mime_type)) if opts else "")
    headers = _headers(f, etag, filename)
    if request.headers.get("if-none-match", "").strip('W/ "') == etag:
        return Response(status_code=304, headers=headers)
    storage = get_storage()

    if opts:  # resized / converted image, generated once and cached
        variant_key = f"{f.storage_key.rsplit('/', 1)[0]}/{images.variant_name(opts, f.mime_type)}"
        if storage.exists(variant_key):
            data = storage.read_bytes(variant_key)
            mime = images.FORMATS[variant_key.rsplit(".", 1)[1]][1]
        else:
            enforce_rate(f"imgvariant:{client_ip(request)}", 120, "image size requests")
            try:
                data, mime = images.transform(storage.read_bytes(f.storage_key), opts, f.mime_type)
            except images.TransformError as exc:
                return JSONResponse(status_code=422, content={"error": {"code": "image_error", "message": str(exc)}})
            storage.put_bytes(variant_key, data, mime)
        asset_sync.count_hit(project.id, len(data))
        headers["Content-Disposition"] = headers["Content-Disposition"].rsplit(".", 1)[0] + "." + variant_key.rsplit(".", 1)[1]
        return Response(content=b"" if request.method == "HEAD" else data, media_type=mime, headers=headers)

    content_type = f.mime_type if not f.export_format else drive.GOOGLE_EXPORTS.get(f.mime_type, ("", "application/pdf"))[1]
    local = storage.local_path(f.storage_key)
    if local is not None:
        asset_sync.count_hit(project.id, f.size)
        resp = FileResponse(local, media_type=content_type, headers=headers)
        resp.headers["etag"] = f'"{etag}"'
        return resp

    # S3 / R2: support byte ranges so videos can be streamed and skipped
    start = end = None
    rng = request.headers.get("range", "")
    m = re.match(r"bytes=(\d*)-(\d*)$", rng)
    if m and (m.group(1) or m.group(2)):
        if m.group(1):
            start, end = int(m.group(1)), int(m.group(2)) if m.group(2) else None
        else:
            start, end = max(0, f.size - int(m.group(2))), None
    body, length, content_range = storage.open_range(f.storage_key, start, end)
    headers["Accept-Ranges"] = "bytes"
    if length is not None:
        headers["Content-Length"] = str(length)
    status = 200
    if content_range:
        headers["Content-Range"] = content_range
        status = 206
    asset_sync.count_hit(project.id, int(length or 0))
    if request.method == "HEAD":
        body.close()
        return Response(status_code=status, headers=headers, media_type=content_type)
    return StreamingResponse(body.iter_chunks(1024 * 256), status_code=status, media_type=content_type, headers=headers)
