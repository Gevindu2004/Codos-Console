"""ThumbsUp Sheets: Google Sheets as a database.

  Dashboard   /dashboard/sheets/...                 (login cookie)
  Developer   /v1/sheets/...                        (secret API key)
  Websites    POST /v1/sheets/submit/{table_id}     (public key + allowed website, insert only)
  Google      GET  /dashboard/sheets/google/callback (Sign in with Google returns here)
"""

import base64
import hashlib
import hmac
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlparse

import jwt
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import ApiError, check_public_key, client_ip, enforce_rate, get_current_user, get_secret_key
from app.models import ApiKey, SheetConnection, SheetDatabase, SheetEvent, SheetMigration, SheetOp, SheetRow, SheetTable, User
from app.routers.common import get_owned
from app.routers.forms_util import read_form
from app.services import sheet_schema, sheets_engine as engine, sheets_google as google
from app.services.crypto import encrypt
from app.services.drive import service_account_email

dashboard = APIRouter(prefix="/dashboard/sheets", tags=["Dashboard: Sheets"])
developer = APIRouter(prefix="/v1/sheets", tags=["Sheets API"])

OAUTH_COOKIE = "tu_google_oauth"
OAUTH_COOKIE_PATH = "/dashboard/sheets/google"


# ====================================================================== errors
@contextmanager
def google_errors(db: Session, database: SheetDatabase | None = None):
    """Turn Google/engine problems into clear API errors."""
    try:
        yield
    except engine.EngineError as exc:
        raise ApiError(exc.status, exc.code, exc.message) from exc
    except google.SheetsAuthError as exc:
        if database is not None:
            _mark_no_access(db, database, "The Google account was disconnected. Reconnect it in ThumbsUp.")
        raise ApiError(409, "google_disconnected", str(exc), hint="Dashboard > Sheets > Connect Google account.") from exc
    except google.SheetsAccessError as exc:
        if database is not None:
            _mark_no_access(db, database, "ThumbsUp can't open this spreadsheet any more (deleted, or access removed).")
        raise ApiError(409, "no_access", "ThumbsUp can't open this spreadsheet (it was deleted, or access was removed).") from exc
    except google.SheetsError as exc:
        if exc.temporary:
            raise ApiError(503, "google_busy", str(exc), headers={"Retry-After": "30"}) from exc
        raise ApiError(502, "google_error", str(exc)) from exc


def _mark_no_access(db: Session, database: SheetDatabase, msg: str) -> None:
    db.rollback()
    database.status, database.last_error = "no_access", msg
    db.add(SheetEvent(database_id=database.id, user_id=database.user_id, kind="access_lost", message=msg))
    db.commit()


# ====================================================================== views
def spreadsheet_url(d: SheetDatabase) -> str:
    return f"https://docs.google.com/spreadsheets/d/{d.spreadsheet_id}/edit"


def verification_code(user_id: str, spreadsheet_id: str) -> str:
    mac = hmac.new(settings.JWT_SECRET.encode(), f"sheet:{user_id}:{spreadsheet_id}".encode(), hashlib.sha256).hexdigest()
    return f"tu-{mac[:8]}"


def table_view(t: SheetTable) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "columns": t.columns,
        "system_columns": list(sheet_schema.SYSTEM_COLUMNS),
        "row_count": t.row_count,
        "allow_public_insert": t.allow_public_insert,
        "submit_url": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/v1/sheets/submit/{t.id}",
        "refreshed_at": t.refreshed_at,
    }


def database_view(db: Session, d: SheetDatabase, with_tables: bool = True) -> dict:
    conn = db.get(SheetConnection, d.connection_id) if d.connection_id else None
    counts = dict(db.execute(
        select(SheetOp.status, func.count()).where(SheetOp.database_id == d.id, SheetOp.status.in_(["pending", "failed"]))
        .group_by(SheetOp.status)
    ).all())
    out = {
        "id": d.id,
        "name": d.name,
        "auth_mode": d.auth_mode,
        "google_email": conn.google_email if conn else (service_account_email() if d.auth_mode == "robot" else None),
        "connection_id": d.connection_id,
        "spreadsheet_id": d.spreadsheet_id,
        # Until ownership is proven we don't reveal anything about someone else's sheet, not even its name
        "spreadsheet_title": d.spreadsheet_title if d.verified_at is not None else "",
        "spreadsheet_url": spreadsheet_url(d),
        "status": d.status,
        "verified": d.verified_at is not None,
        "verification_code": verification_code(d.user_id, d.spreadsheet_id) if d.auth_mode == "robot" else None,
        "last_error": d.last_error,
        "pending_writes": counts.get("pending", 0),
        "failed_writes": counts.get("failed", 0),
        "last_synced_at": d.last_synced_at,
        "created_at": d.created_at,
    }
    if with_tables:
        out["tables"] = [table_view(t) for t in db.scalars(
            select(SheetTable).where(SheetTable.database_id == d.id).order_by(SheetTable.created_at, SheetTable.name))]
    return out


# ====================================================================== shared row logic
def _fresh(db: Session, database: SheetDatabase, table: SheetTable) -> bool:
    """Refresh our copy from Google when it's old. Returns True only when Google couldn't be read
    (our copy is then served as it is). Skipped refreshes (writes still on their way, or another
    refresh running) are not "stale": our copy already has the newest data."""
    if database.status != "active" or not engine.needs_refresh(table):
        return False
    try:
        engine.refresh_table(db, database, table)
        return False
    except engine.EngineError as exc:
        if exc.code == "tab_deleted":
            db.add(SheetEvent(database_id=database.id, user_id=database.user_id, kind="table_removed",
                              message=f"The tab '{table.name}' was deleted in Google Sheets, so the table was removed."))
            db.delete(table)
            db.commit()
            raise ApiError(404, "table_not_found", f"The tab '{table.name}' was deleted from the spreadsheet.") from exc
        return True
    except (google.SheetsAuthError, google.SheetsAccessError) as exc:
        with google_errors(db, database):
            raise exc
    except google.SheetsError:
        db.rollback()
        return True  # Google is slow/busy: serve our copy


def list_rows(db: Session, table: SheetTable, request: Request, limit: int, offset: int,
              search: str | None, sort: str | None, order: str) -> dict:
    filters = {}
    for k, v in request.query_params.items():
        if k.startswith("filter[") and k.endswith("]"):
            filters[k[7:-1].lower()] = v
    names = {c["name"].lower(): c["name"] for c in table.columns} | {s: s for s in sheet_schema.SYSTEM_COLUMNS}
    for f in filters:
        if f not in names:
            raise ApiError(422, "unknown_column", f"Can't filter by '{f[:60]}': '{table.name}' has no such column.")
    if sort and sort.lower() not in names:
        raise ApiError(422, "unknown_column", f"Can't sort by '{sort[:60]}': '{table.name}' has no such column.")

    base = select(SheetRow).where(SheetRow.table_id == table.id)
    if not filters and not search and not sort:
        total = db.scalar(select(func.count()).select_from(SheetRow).where(SheetRow.table_id == table.id))
        rows = list(db.scalars(base.order_by(SheetRow.position, SheetRow.pk).offset(offset).limit(limit)))
        return {"rows": [engine.row_view(r) for r in rows], "total": total, "limit": limit, "offset": offset}

    views = [engine.row_view(r) for r in db.scalars(base.order_by(SheetRow.position, SheetRow.pk))]

    def matches(v: dict) -> bool:
        for f, want in filters.items():
            got = v.get(names[f])
            if got is None:
                got = ""
            if str(got).lower() != want.lower():
                return False
        if search:
            s = search.lower()
            if not any(s in str(x).lower() for k, x in v.items() if x is not None and k not in sheet_schema.SYSTEM_COLUMNS):
                return False
        return True

    views = [v for v in views if matches(v)]
    if sort:
        key = names[sort.lower()]
        views.sort(key=lambda v: (v.get(key) is None, str(type(v.get(key))), v.get(key) if v.get(key) is not None else ""),
                   reverse=order == "desc")
    return {"rows": views[offset: offset + limit], "total": len(views), "limit": limit, "offset": offset}


class RowsIn(BaseModel):
    rows: list[dict] = Field(min_length=1)


async def _row_payload(request: Request) -> list[dict]:
    try:
        body = await request.json()
    except ValueError:
        raise ApiError(400, "invalid_json", "Send a JSON object (one row) or {\"rows\": [...]}.")
    if isinstance(body, dict) and isinstance(body.get("rows"), list):
        records = body["rows"]
    elif isinstance(body, list):
        records = body
    elif isinstance(body, dict):
        records = [body]
    else:
        raise ApiError(400, "invalid_json", "Send a JSON object (one row) or {\"rows\": [...]}.")
    if not records:
        raise ApiError(422, "no_rows", "Send at least one row.")
    if len(records) > settings.SHEETS_MAX_BATCH:
        raise ApiError(422, "too_many_rows", f"Send at most {settings.SHEETS_MAX_BATCH} rows per request.")
    return records


def _insert(db: Session, database: SheetDatabase, table: SheetTable, records: list[dict], wait: bool) -> JSONResponse:
    with google_errors(db, database):
        rows, op_ids = engine.queue_insert(db, database, table, records)
    synced = engine.wait_for(db, op_ids) if wait else False
    data = [engine.row_view(r) for r in rows]
    body = {"row": data[0], "synced": synced} if len(data) == 1 else {"rows": data, "count": len(data), "synced": synced}
    return JSONResponse(jsonable(body), status_code=201)


def jsonable(v):
    from fastapi.encoders import jsonable_encoder

    return jsonable_encoder(v)


# ====================================================================== dashboard: setup
def _owned_db(db: Session, user: User, database_id: str) -> SheetDatabase:
    return get_owned(db, SheetDatabase, database_id, user)


def _owned_table(db: Session, user: User, table_id: str) -> tuple[SheetDatabase, SheetTable]:
    t = db.get(SheetTable, table_id)
    if t is None or t.user_id != user.id:
        raise ApiError(404, "not_found", "Table not found.")
    return db.get(SheetDatabase, t.database_id), t


@dashboard.get("/config")
def config(user: User = Depends(get_current_user)):
    picker = None
    if settings.sheets_oauth_configured and settings.GOOGLE_PICKER_API_KEY and settings.GOOGLE_CLOUD_PROJECT_NUMBER:
        picker = {"api_key": settings.GOOGLE_PICKER_API_KEY, "app_id": settings.GOOGLE_CLOUD_PROJECT_NUMBER}
    return {
        "oauth_enabled": settings.sheets_oauth_configured,
        "robot_enabled": settings.sheets_robot_configured,
        "robot_email": service_account_email() if settings.sheets_robot_configured else None,
        "picker": picker,
        "types": list(sheet_schema.TYPES),
        "limits": {
            "max_tables": settings.SHEETS_MAX_TABLES,
            "max_columns": settings.SHEETS_MAX_COLUMNS,
            "max_rows": settings.SHEETS_MAX_ROWS_PER_TABLE,
            "max_batch": settings.SHEETS_MAX_BATCH,
        },
    }


# ---------------------------------------------------------------- Sign in with Google
def _require_oauth() -> None:
    if not settings.sheets_oauth_configured:
        raise ApiError(503, "google_signin_not_configured", "Sign in with Google isn't set up on this server yet.",
                       hint="The server admin adds GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in thumbsup-api/.env.")


@dashboard.post("/google/start")
def google_start(user: User = Depends(get_current_user)):
    _require_oauth()
    nonce = secrets.token_urlsafe(24)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = jwt.encode(
        {"p": "google_oauth", "sub": user.id, "sv": user.session_version or 0, "n": nonce,
         "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        settings.JWT_SECRET, algorithm="HS256",
    )
    resp = JSONResponse({"url": google.auth_url(state, challenge)})
    resp.set_cookie(OAUTH_COOKIE, f"{nonce}.{verifier}", max_age=600, httponly=True, secure=settings.COOKIE_SECURE,
                    samesite="lax", path=OAUTH_COOKIE_PATH)
    return resp


def _back(**params) -> RedirectResponse:
    resp = RedirectResponse(f"{settings.dashboard_url}?{urlencode(params)}", status_code=303)
    resp.delete_cookie(OAUTH_COOKIE, path=OAUTH_COOKIE_PATH)
    return resp


@dashboard.get("/google/callback", include_in_schema=False)
def google_callback(request: Request, state: str = "", code: str = "", error: str = "", db: Session = Depends(get_db)):
    """Google sends the browser back here. Every check fails closed and returns to the dashboard."""
    if not settings.sheets_oauth_configured:
        return _back(tu_sheets_error="not_configured")
    if error:
        return _back(tu_sheets_error="cancelled" if error == "access_denied" else "google_error")
    try:
        claims = jwt.decode(state, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return _back(tu_sheets_error="expired")
    cookie = request.cookies.get(OAUTH_COOKIE, "")
    nonce, _, verifier = cookie.partition(".")
    if claims.get("p") != "google_oauth" or not nonce or not hmac.compare_digest(nonce, str(claims.get("n", ""))):
        return _back(tu_sheets_error="state_mismatch")
    try:
        user = get_current_user(request, db)
    except ApiError:
        return _back(tu_sheets_error="not_logged_in")
    if user.id != claims.get("sub") or (user.session_version or 0) != claims.get("sv"):
        return _back(tu_sheets_error="state_mismatch")
    if not code:
        return _back(tu_sheets_error="google_error")
    try:
        tokens = google.exchange_code(code, verifier)
    except google.SheetsError:
        return _back(tu_sheets_error="google_error")
    if google.DRIVE_FILE_SCOPE not in tokens["scope"].split():
        if tokens.get("refresh_token"):
            google.revoke(tokens["refresh_token"])
        return _back(tu_sheets_error="permission_missing")
    if not tokens["sub"]:
        return _back(tu_sheets_error="google_error")

    conn = db.scalar(select(SheetConnection).where(SheetConnection.user_id == user.id, SheetConnection.google_sub == tokens["sub"]))
    if not tokens.get("refresh_token") and (conn is None or conn.status != "active"):
        return _back(tu_sheets_error="no_refresh_token")
    if conn is None:
        conn = SheetConnection(user_id=user.id, google_sub=tokens["sub"], refresh_token_enc="")
        db.add(conn)
    if tokens.get("refresh_token"):
        conn.refresh_token_enc = encrypt(tokens["refresh_token"])
    conn.google_email = tokens["email"][:320]
    conn.scopes = tokens["scope"][:500]
    conn.status, conn.last_error = "active", None
    db.commit()
    google.forget_client(conn.id)
    # Sheets that lost access because of this account work again
    for d in db.scalars(select(SheetDatabase).where(SheetDatabase.connection_id == conn.id, SheetDatabase.status == "no_access")):
        d.status, d.last_error = "active", None
        db.execute(SheetOp.__table__.update().where(SheetOp.database_id == d.id, SheetOp.status == "pending").values(next_attempt_at=None))
    db.commit()
    engine.wake()
    return _back(tu_sheets="connected", account=conn.id)


@dashboard.get("/connections")
def list_connections(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(SheetConnection).where(SheetConnection.user_id == user.id).order_by(SheetConnection.created_at))
    return {"connections": [{"id": c.id, "google_email": c.google_email, "status": c.status, "last_error": c.last_error,
                             "created_at": c.created_at} for c in rows]}


@dashboard.delete("/connections/{connection_id}")
def delete_connection(connection_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conn = get_owned(db, SheetConnection, connection_id, user)
    from app.services.crypto import decrypt

    try:
        google.revoke(decrypt(conn.refresh_token_enc))
    except ValueError:
        pass
    google.forget_client(conn.id)
    for d in db.scalars(select(SheetDatabase).where(SheetDatabase.connection_id == conn.id)):
        d.status, d.last_error = "no_access", "The Google account was disconnected. Reconnect it to keep using this sheet."
    db.delete(conn)
    db.commit()
    return {"deleted": True}


@dashboard.post("/connections/{connection_id}/picker-token")
def picker_token(connection_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """A short-lived token for Google's file picker (the customer's own, drive.file only)."""
    conn = get_owned(db, SheetConnection, connection_id, user)
    if conn.status != "active":
        raise ApiError(409, "google_disconnected", "Reconnect this Google account first.")
    with google_errors(db):
        token = google.oauth_client(conn).tokens.token()
    return {"access_token": token}


# ---------------------------------------------------------------- databases
class DatabaseIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    mode: str = Field(pattern="^(new|existing|robot)$")
    connection_id: str | None = None
    spreadsheet: str = Field(default="", max_length=500)


class DatabaseUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


def _verified_elsewhere(db: Session, spreadsheet_id: str, user_id: str) -> SheetDatabase | None:
    return db.scalar(select(SheetDatabase).where(
        SheetDatabase.spreadsheet_id == spreadsheet_id, SheetDatabase.verified_at.is_not(None), SheetDatabase.user_id != user_id))


@dashboard.get("/databases")
def list_databases(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(SheetDatabase).where(SheetDatabase.user_id == user.id).order_by(SheetDatabase.created_at.desc()))
    return {"databases": [database_view(db, d) for d in rows]}


@dashboard.post("/databases", status_code=201)
def create_database(body: DatabaseIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.scalar(select(func.count()).select_from(SheetDatabase).where(SheetDatabase.user_id == user.id))
    if count >= 200:
        raise ApiError(409, "limit_reached", "You can connect up to 200 spreadsheets.")
    name = body.name.strip()

    if body.mode in ("new", "existing"):
        _require_oauth()
        conn = get_owned(db, SheetConnection, body.connection_id or "", user) if body.connection_id else None
        if conn is None:
            raise ApiError(422, "connection_required", "Choose which Google account to use.")
        if conn.status != "active":
            raise ApiError(409, "google_disconnected", "Reconnect this Google account first.")
        c = google.oauth_client(conn)
        if body.mode == "new":
            with google_errors(db):
                info = c.create(name[:100])
            d = SheetDatabase(user_id=user.id, auth_mode="oauth", connection_id=conn.id, name=name, spreadsheet_id=info.id,
                              spreadsheet_title=info.title, status="active", verified_at=datetime.now(timezone.utc))
            db.add(d)
            db.flush()
            engine.event(db, d, "connected", f"Created a new spreadsheet '{info.title}' in {conn.google_email}'s Google Drive.")
            db.commit()
            return database_view(db, d)
        sid = google.parse_spreadsheet_id(body.spreadsheet)
        if not sid:
            raise ApiError(422, "invalid_link", "That isn't a Google Sheets link.",
                           hint="It looks like https://docs.google.com/spreadsheets/d/.../edit")
        _not_taken(db, user, sid)
        try:
            with google_errors(db):
                info = c.get(sid)
        except ApiError as exc:
            if exc.code == "no_access":
                raise ApiError(403, "not_picked", "ThumbsUp can only open sheets you pick with the Google file picker or create here.",
                               hint="Click 'Pick from Google Drive' and choose the sheet.") from exc
            raise
        d = SheetDatabase(user_id=user.id, auth_mode="oauth", connection_id=conn.id, name=name, spreadsheet_id=sid,
                          spreadsheet_title=info.title, status="active", verified_at=datetime.now(timezone.utc))
        db.add(d)
        db.flush()
        with google_errors(db):
            n = engine.adopt_tabs(db, d)
        engine.event(db, d, "connected", f"Connected '{info.title}' ({n} tab{'s' if n != 1 else ''} with a header row became tables).")
        db.commit()
        return database_view(db, d)

    # robot: the customer shared the sheet with our service account
    if not settings.sheets_robot_configured:
        raise ApiError(503, "robot_not_configured", "Sharing with the ThumbsUp robot isn't set up on this server.")
    sid = google.parse_spreadsheet_id(body.spreadsheet)
    if not sid:
        raise ApiError(422, "invalid_link", "That isn't a Google Sheets link.", hint="It looks like https://docs.google.com/spreadsheets/d/.../edit")
    _not_taken(db, user, sid)
    robot = SheetDatabase(user_id=user.id, auth_mode="robot", name=name, spreadsheet_id=sid)
    try:
        info = google.client_for(robot).get(sid)
    except google.SheetsAccessError as exc:
        raise ApiError(403, "not_shared", f"ThumbsUp can't open that sheet yet. Share it with {service_account_email()} as Editor.") from exc
    except google.SheetsError as exc:
        with google_errors(db):
            raise exc
    robot.spreadsheet_title = info.title[:255]
    robot.status = "needs_verification"
    db.add(robot)
    db.flush()
    engine.event(db, robot, "connected", "ThumbsUp can open the sheet. Waiting for the verification code in its name.")
    db.commit()
    return database_view(db, robot)


def _not_taken(db: Session, user: User, sid: str) -> None:
    if db.scalar(select(SheetDatabase).where(SheetDatabase.user_id == user.id, SheetDatabase.spreadsheet_id == sid)):
        raise ApiError(409, "already_connected", "This spreadsheet is already connected to your account.")
    if _verified_elsewhere(db, sid, user.id):
        raise ApiError(409, "sheet_taken", "This spreadsheet is already connected to another ThumbsUp account.")


@dashboard.post("/databases/{database_id}/verify")
def verify_database(database_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    if d.verified_at is not None:
        return database_view(db, d)
    enforce_rate(f"sheetverify:{user.id}", 20, "verification checks")
    if _verified_elsewhere(db, d.spreadsheet_id, user.id):
        raise ApiError(409, "sheet_taken", "This spreadsheet is already connected to another ThumbsUp account.")
    with google_errors(db):
        info = google.client_for(d).get(d.spreadsheet_id)
    code = verification_code(user.id, d.spreadsheet_id)
    if code not in info.title:
        raise ApiError(409, "code_not_found", f"The spreadsheet's name doesn't contain {code} yet.",
                       hint="Rename the spreadsheet in Google Sheets so its name includes the code, then try again.")
    d.verified_at = datetime.now(timezone.utc)
    d.status = "active"
    d.spreadsheet_title = info.title[:255]
    with google_errors(db, d):
        n = engine.adopt_tabs(db, d)
    engine.event(db, d, "verified", f"Ownership verified. {n} tab{'s' if n != 1 else ''} with a header row became tables. "
                                    "You can remove the code from the name now.")
    db.commit()
    return database_view(db, d)


@dashboard.get("/databases/{database_id}")
def get_database(database_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return database_view(db, _owned_db(db, user, database_id))


@dashboard.patch("/databases/{database_id}")
def update_database(database_id: str, body: DatabaseUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    d.name = body.name.strip()
    db.commit()
    return database_view(db, d)


@dashboard.delete("/databases/{database_id}")
def delete_database(database_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Disconnects. The Google spreadsheet itself is never deleted."""
    d = _owned_db(db, user, database_id)
    db.delete(d)
    db.commit()
    return {"deleted": True}


@dashboard.post("/databases/{database_id}/refresh")
def refresh_database(database_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    enforce_rate(f"sheetrefresh:{user.id}", 30, "refreshes")
    if d.status != "active":
        return database_view(db, d)
    engine.flush_database(d.id)
    db.expire_all()
    for t in list(db.scalars(select(SheetTable).where(SheetTable.database_id == d.id))):
        t.refreshed_at = None
        try:
            _fresh(db, d, t)
        except ApiError as exc:
            if exc.code != "table_not_found":
                raise
    db.expire_all()
    return database_view(db, db.get(SheetDatabase, d.id))


@dashboard.post("/databases/{database_id}/retry")
def retry_failed(database_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    n = db.execute(SheetOp.__table__.update().where(SheetOp.database_id == d.id, SheetOp.status == "failed")
                   .values(status="pending", attempts=0, next_attempt_at=None)).rowcount
    db.commit()
    engine.wake()
    return {"retried": n}


@dashboard.get("/databases/{database_id}/events")
def database_events(database_id: str, limit: int = Query(default=50, ge=1, le=200), user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    rows = db.scalars(select(SheetEvent).where(SheetEvent.database_id == d.id).order_by(SheetEvent.created_at.desc()).limit(limit))
    return {"events": [{"id": e.id, "kind": e.kind, "message": e.message, "created_at": e.created_at} for e in rows]}


@dashboard.get("/databases/{database_id}/migrations")
def database_migrations(database_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    rows = db.scalars(select(SheetMigration).where(SheetMigration.database_id == d.id).order_by(SheetMigration.created_at.desc()).limit(100))
    return {"migrations": [{"id": m.id, "name": m.name, "source": m.source, "changes": m.changes,
                            "descriptions": [sheet_schema.describe(s) for s in m.changes], "created_at": m.created_at} for m in rows]}


# ---------------------------------------------------------------- schema
class DetectIn(BaseModel):
    code: str = Field(min_length=1, max_length=sheet_schema.MAX_SOURCE_CHARS)
    kind: str = Field(default="auto", pattern="^(auto|sql|html|js|json|csv)$")
    table: str = Field(default="", max_length=50)


class Change(BaseModel):
    op: str = Field(pattern="^(create_table|add_column|drop_column|rename_column|alter_column|move_column|rename_table|drop_table)$")
    table: str = Field(min_length=1, max_length=60)
    columns: list[dict] | None = Field(default=None, max_length=200)
    column: dict | str | None = None
    to: str | None = Field(default=None, max_length=63)
    type: str | None = None
    required: bool | None = None
    position: int | None = Field(default=None, ge=0, le=500)


class SchemaIn(BaseModel):
    changes: list[Change] | None = Field(default=None, max_length=200)
    code: str | None = Field(default=None, max_length=sheet_schema.MAX_SOURCE_CHARS)
    kind: str = Field(default="auto", pattern="^(auto|sql|html|js|json|csv)$")
    table: str = Field(default="", max_length=50)
    name: str | None = Field(default=None, max_length=120)
    dry_run: bool = False


def _detect(code: str, kind: str, table: str) -> dict:
    try:
        return sheet_schema.parse(code, kind, sheet_schema.check_table_name(table) if table else "")
    except sheet_schema.SchemaError as exc:
        raise ApiError(422, "invalid_schema", str(exc)) from exc


@dashboard.post("/detect")
def detect(body: DetectIn, user: User = Depends(get_current_user)):
    """Find columns in pasted code. Nothing is changed; the customer reviews the result first."""
    enforce_rate(f"sheetdetect:{user.id}", 60, "requests")
    return _detect(body.code, body.kind, body.table)


def _changes(body: SchemaIn) -> tuple[list[dict], str]:
    if body.changes:
        return [c.model_dump(exclude_none=True) for c in body.changes], "dashboard"
    if body.code:
        parsed = _detect(body.code, body.kind, body.table)
        return parsed["changes"], parsed["kind"]
    raise ApiError(422, "nothing_to_apply", "Send 'changes' or 'code'.")


def _apply(db: Session, d: SheetDatabase, changes: list[dict], source: str, name: str | None, dry_run: bool) -> dict:
    for ch in changes:  # normalise the dashboard shape (column may be a dict or a name)
        if ch.get("op") in ("drop_column", "rename_column", "alter_column", "move_column") and isinstance(ch.get("column"), dict):
            ch["column"] = ch["column"].get("name", "")
        if ch.get("op") == "add_column" and isinstance(ch.get("column"), str):
            ch["column"] = {"name": ch["column"], "type": ch.get("type") or "text", "required": bool(ch.get("required"))}
        if ch.get("op") in ("drop_column", "rename_column", "alter_column", "move_column") and not ch.get("column"):
            raise ApiError(422, "invalid_schema", f"'{ch['op']}' needs a column name.")
        if ch.get("op") in ("rename_column", "rename_table") and not ch.get("to"):
            raise ApiError(422, "invalid_schema", f"'{ch['op']}' needs a new name ('to').")
        if ch.get("op") == "move_column" and ch.get("position") is None:
            raise ApiError(422, "invalid_schema", "'move_column' needs a position.")
    with google_errors(db, d):
        result = engine.apply_changes(db, d, changes, source=source, name=name, dry_run=dry_run)
    db.expire_all()
    result["database"] = database_view(db, db.get(SheetDatabase, d.id))
    return result


@dashboard.post("/databases/{database_id}/schema")
def apply_schema(database_id: str, body: SchemaIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    changes, source = _changes(body)
    return _apply(db, d, changes, source, body.name, body.dry_run)


# ---------------------------------------------------------------- tables & columns (dashboard shortcuts)
class TableIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    columns: list[dict] = Field(default_factory=list, max_length=200)


class TableUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    allow_public_insert: bool | None = None


class ColumnIn(BaseModel):
    name: str = Field(min_length=1, max_length=63)
    type: str = "text"
    required: bool = False
    position: int | None = Field(default=None, ge=0, le=500)


class ColumnUpdate(BaseModel):
    column: str = Field(min_length=1, max_length=63)
    new_name: str | None = Field(default=None, max_length=63)
    type: str | None = None
    required: bool | None = None
    position: int | None = Field(default=None, ge=0, le=500)


@dashboard.post("/databases/{database_id}/tables", status_code=201)
def create_table(database_id: str, body: TableIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = _owned_db(db, user, database_id)
    if db.scalar(select(SheetTable).where(SheetTable.database_id == d.id, SheetTable.name_key == body.name.strip().lower())):
        raise ApiError(409, "table_exists", f"There's already a table called '{body.name.strip()}'.")
    return _apply(db, d, [{"op": "create_table", "table": body.name.strip(), "columns": body.columns}], "dashboard", None, False)


@dashboard.patch("/tables/{table_id}")
def update_table(table_id: str, body: TableUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    if body.allow_public_insert is not None:
        t.allow_public_insert = body.allow_public_insert
        db.commit()
    if body.name and body.name.strip() != t.name:
        return _apply(db, d, [{"op": "rename_table", "table": t.name, "to": body.name.strip()}], "dashboard", None, False)
    return {"table": table_view(t)}


@dashboard.delete("/tables/{table_id}")
def delete_table(table_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    return _apply(db, d, [{"op": "drop_table", "table": t.name}], "dashboard", None, False)


@dashboard.post("/tables/{table_id}/columns", status_code=201)
def add_column(table_id: str, body: ColumnIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    if any(c["name"].lower() == body.name.strip().lower() for c in t.columns):
        raise ApiError(409, "column_exists", f"'{t.name}' already has a column called '{body.name.strip()}'.")
    ch = {"op": "add_column", "table": t.name, "column": {"name": body.name.strip(), "type": body.type, "required": body.required}}
    if body.position is not None:
        ch["position"] = body.position
    return _apply(db, d, [ch], "dashboard", None, False)


@dashboard.patch("/tables/{table_id}/columns")
def update_column(table_id: str, body: ColumnUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    changes: list[dict] = []
    current = body.column
    if body.type is not None or body.required is not None:
        changes.append({"op": "alter_column", "table": t.name, "column": current, "type": body.type, "required": body.required})
    if body.new_name and body.new_name.strip() != current:
        changes.append({"op": "rename_column", "table": t.name, "column": current, "to": body.new_name.strip()})
        current = body.new_name.strip()
    if body.position is not None:
        changes.append({"op": "move_column", "table": t.name, "column": current, "position": body.position})
    if not changes:
        raise ApiError(422, "nothing_to_update", "Nothing to change.")
    return _apply(db, d, changes, "dashboard", None, False)


@dashboard.delete("/tables/{table_id}/columns")
def delete_column(table_id: str, name: str = Query(min_length=1, max_length=63), user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    return _apply(db, d, [{"op": "drop_column", "table": t.name, "column": name}], "dashboard", None, False)


# ---------------------------------------------------------------- rows (dashboard)
@dashboard.get("/tables/{table_id}/rows")
def dash_rows(table_id: str, request: Request, limit: int = Query(default=100, ge=1, le=1000), offset: int = Query(default=0, ge=0),
              search: str | None = Query(default=None, max_length=200), sort: str | None = None,
              order: str = Query(default="asc", pattern="^(asc|desc)$"),
              user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    stale = _fresh(db, d, t)
    out = list_rows(db, t, request, limit, offset, search, sort, order)
    out["stale"] = stale
    out["table"] = table_view(t)
    return out


@dashboard.post("/tables/{table_id}/rows", status_code=201)
async def dash_insert(table_id: str, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    return _insert(db, d, t, await _row_payload(request), wait=False)


@dashboard.patch("/tables/{table_id}/rows/{row_id}")
async def dash_update(table_id: str, row_id: str, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    body = await _json_object(request)
    with google_errors(db, d):
        row, _ = engine.queue_update(db, d, t, row_id, body)
    return {"row": engine.row_view(row), "synced": False}


@dashboard.delete("/tables/{table_id}/rows/{row_id}")
def dash_delete(table_id: str, row_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d, t = _owned_table(db, user, table_id)
    with google_errors(db, d):
        engine.queue_delete(db, d, t, row_id)
    return {"deleted": True}


async def _json_object(request: Request) -> dict:
    try:
        body = await request.json()
    except ValueError:
        raise ApiError(400, "invalid_json", "Send a JSON object.")
    if not isinstance(body, dict):
        raise ApiError(400, "invalid_json", "Send a JSON object.")
    return body


# ====================================================================== developer API (secret key)
def _dev_db(db: Session, key: ApiKey, ref: str) -> SheetDatabase:
    d = db.get(SheetDatabase, ref)
    if d is None or d.user_id != key.user_id:
        raise ApiError(404, "database_not_found", "No spreadsheet with this id in your account.",
                       hint="Find the id (sdb_...) in the ThumbsUp dashboard > Sheets.")
    return d


def _dev_table(db: Session, d: SheetDatabase, ref: str) -> SheetTable:
    t = db.get(SheetTable, ref) if ref.startswith("tbl_") else None
    if t is None:
        t = db.scalar(select(SheetTable).where(SheetTable.database_id == d.id, SheetTable.name_key == ref.strip().lower()))
    if t is None or t.database_id != d.id:
        raise ApiError(404, "table_not_found", f"No table '{ref[:60]}' in this spreadsheet.")
    return t


@developer.get("")
def api_databases(key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    rows = db.scalars(select(SheetDatabase).where(SheetDatabase.user_id == key.user_id).order_by(SheetDatabase.created_at))
    return {"databases": [database_view(db, d) for d in rows]}


@developer.get("/{database_id}")
def api_database(database_id: str, key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    return database_view(db, _dev_db(db, key, database_id))


class MigrateIn(BaseModel):
    sql: str | None = Field(default=None, max_length=sheet_schema.MAX_SOURCE_CHARS)
    code: str | None = Field(default=None, max_length=sheet_schema.MAX_SOURCE_CHARS)
    kind: str = Field(default="auto", pattern="^(auto|sql|html|js|json|csv)$")
    table: str = Field(default="", max_length=50)
    name: str | None = Field(default=None, max_length=120)
    dry_run: bool = False


@developer.post("/{database_id}/migrate")
def api_migrate(database_id: str, body: MigrateIn, key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    """Run schema code from your project, e.g. migrations/001_init.sql. With a 'name', it runs only once."""
    d = _dev_db(db, key, database_id)
    code = body.sql or body.code
    if not code:
        raise ApiError(422, "nothing_to_apply", "Send 'sql' (or 'code').")
    parsed = _detect(code, "sql" if body.sql else body.kind, body.table)
    return _apply(db, d, parsed["changes"], "api" if parsed["kind"] == "sql" else parsed["kind"], body.name, body.dry_run)


@developer.get("/{database_id}/{table}/rows")
def api_rows(database_id: str, table: str, request: Request, limit: int = Query(default=100, ge=1, le=1000),
             offset: int = Query(default=0, ge=0), search: str | None = Query(default=None, max_length=200),
             sort: str | None = None, order: str = Query(default="asc", pattern="^(asc|desc)$"),
             key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    d = _dev_db(db, key, database_id)
    t = _dev_table(db, d, table)
    stale = _fresh(db, d, t)
    out = list_rows(db, t, request, limit, offset, search, sort, order)
    headers = {"X-ThumbsUp-Stale": "true"} if stale else {}
    return JSONResponse(jsonable(out), headers=headers)


@developer.get("/{database_id}/{table}/rows/{row_id}")
def api_row(database_id: str, table: str, row_id: str, key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    d = _dev_db(db, key, database_id)
    t = _dev_table(db, d, table)
    _fresh(db, d, t)
    with google_errors(db, d):
        return {"row": engine.row_view(engine.get_row(db, t, row_id))}


@developer.post("/{database_id}/{table}/rows", status_code=201)
async def api_insert(database_id: str, table: str, request: Request, wait: bool = False,
                     key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    d = _dev_db(db, key, database_id)
    t = _dev_table(db, d, table)
    return _insert(db, d, t, await _row_payload(request), wait)


@developer.patch("/{database_id}/{table}/rows/{row_id}")
async def api_update(database_id: str, table: str, row_id: str, request: Request, wait: bool = False,
                     key: ApiKey = Depends(get_secret_key), db: Session = Depends(get_db)):
    d = _dev_db(db, key, database_id)
    t = _dev_table(db, d, table)
    body = await _json_object(request)
    with google_errors(db, d):
        row, op_id = engine.queue_update(db, d, t, row_id, body)
    synced = engine.wait_for(db, [op_id]) if wait else False
    return {"row": engine.row_view(row), "synced": synced}


@developer.delete("/{database_id}/{table}/rows/{row_id}")
def api_delete(database_id: str, table: str, row_id: str, wait: bool = False, key: ApiKey = Depends(get_secret_key),
               db: Session = Depends(get_db)):
    d = _dev_db(db, key, database_id)
    t = _dev_table(db, d, table)
    with google_errors(db, d):
        op_id = engine.queue_delete(db, d, t, row_id)
    synced = engine.wait_for(db, [op_id]) if wait else False
    return {"deleted": True, "synced": synced}


# ====================================================================== websites (public key, insert only)
public = APIRouter(tags=["Sheets: website forms"])


@public.post("/v1/sheets/submit/{table_id}")
async def submit(table_id: str, request: Request, db: Session = Depends(get_db)):
    """A website form adds a row. Needs a PUBLIC key whose allowed websites include this site.
    Rows can only be ADDED this way, never read, changed or deleted."""
    ip = client_ip(request)
    enforce_rate(f"sheetsubmit:{ip}", settings.SHEETS_PUBLIC_RATE_PER_MINUTE, "form submissions")
    fields, _ = await read_form(request, max_files=0)
    raw_key = str(fields.pop("public_key", "") or request.headers.get("x-public-key", ""))
    origin = request.headers.get("origin")
    key = check_public_key(db, raw_key, origin)
    t = db.get(SheetTable, table_id)
    if t is None or t.user_id != key.user_id:
        raise ApiError(404, "table_not_found", "This form's table doesn't exist.")
    if not t.allow_public_insert:
        raise ApiError(403, "public_insert_disabled", "This table doesn't accept website submissions.",
                       hint="Turn on 'Website forms can add rows' for the table in the ThumbsUp dashboard.")
    enforce_rate(f"sheetsubmit-table:{t.id}", 300, "submissions to this table")
    redirect = str(fields.pop("_redirect", "") or "")
    if str(fields.get("_gotcha", "") or "").strip():
        return {"ok": True}  # honeypot filled in: a bot. Pretend it worked.
    record = {k: (", ".join(map(str, v)) if isinstance(v, list) else v) for k, v in fields.items()}
    d = db.get(SheetDatabase, t.database_id)
    with google_errors(db, d):
        rows, _ = engine.queue_insert(db, d, t, [record], strict=False)
    if redirect:
        allowed = {o.rstrip("/").lower() for o in (key.allowed_origins or [])}
        p = urlparse(redirect)
        if p.scheme in ("http", "https") and f"{p.scheme}://{p.netloc}".lower() in allowed:
            return RedirectResponse(redirect, status_code=303)
    return {"ok": True, "id": rows[0].row_id}
