"""The Sheets engine.

Layout of every table (one Google Sheets tab):
    row 1      header: id | <customer columns> | created_at | updated_at
    rows 2..   one row per record. "id" identifies the row, whatever its position.

The GOOGLE SHEET is the source of truth. People may edit it by hand: we re-read it
(at most every SHEETS_CACHE_SECONDS) and follow their changes, columns included.

Writes are queued (SheetOp) and sent in batches: any number of queued inserts,
updates and deletes for a tab cost at most 1 read + 3 writes of Google's quota.
Reads are answered from our copy (SheetRow), so they never wait for Google.

Schema changes (create table, add/rename/move/delete column) are sent as ONE
batchUpdate. Deleting a column uses Google's deleteDimension, so the columns to
its right move left automatically (C becomes B, D becomes C ...).
"""

import logging
import random
import re
import secrets
import threading
import time
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.models import (
    SheetConnection,
    SheetDatabase,
    SheetEvent,
    SheetMigration,
    SheetOp,
    SheetRow,
    SheetTable,
)
from app.services import sheet_schema
from app.services.sheets_google import (
    SheetsAccessError,
    SheetsAuthError,
    SheetsClient,
    SheetsError,
    client_for,
    col_letter,
    quote_tab,
)

log = logging.getLogger("thumbsup.sheets")

SYSTEM = sheet_schema.SYSTEM_COLUMNS
MAX_CELL_CHARS = 50_000  # Google's limit per cell
CLAIM_STALE_SECONDS = 300
MAX_ATTEMPTS = 8


class EngineError(Exception):
    """A problem the customer can fix (shown as a clear message)."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def now() -> datetime:
    return datetime.now(timezone.utc)


def stamp() -> str:
    return now().strftime("%Y-%m-%dT%H:%M:%SZ")


def aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def new_row_id() -> str:
    return "r" + secrets.token_hex(7)


def event(db: Session, database: SheetDatabase, kind: str, message: str) -> None:
    db.add(SheetEvent(database_id=database.id, user_id=database.user_id, kind=kind, message=message[:1000]))


def client(db: Session, database: SheetDatabase) -> SheetsClient:
    conn = db.get(SheetConnection, database.connection_id) if database.connection_id else None
    return client_for(database, conn)


# ====================================================================== claims (one worker per spreadsheet)
def claim(db: Session, database_id: str, wait: float = 0.0) -> bool:
    """Atomic: works across several API servers (Azure scale-out) sharing one PostgreSQL."""
    deadline = time.monotonic() + wait
    while True:
        stale = now() - timedelta(seconds=CLAIM_STALE_SECONDS)
        res = db.execute(
            update(SheetDatabase)
            .where(SheetDatabase.id == database_id)
            .where((SheetDatabase.flush_started_at.is_(None)) | (SheetDatabase.flush_started_at < stale))
            .values(flush_started_at=now())
        )
        db.commit()
        if res.rowcount == 1:
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.2)


def release(db: Session, database_id: str) -> None:
    db.execute(update(SheetDatabase).where(SheetDatabase.id == database_id).values(flush_started_at=None))
    db.commit()


# ====================================================================== values
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[+0-9 ()\-.]{3,30}$")
TRUE = {"true", "yes", "on", "1", "y", "checked"}
FALSE = {"false", "no", "off", "0", "n", ""}


def coerce(col: dict, value):
    """Check one value against its column type. Returns the value to store."""
    name, t = col["name"], col.get("type", "text")
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        raise EngineError(422, "invalid_value", f"'{name}' must be a single value, not an object or list.")
    if isinstance(value, str):
        if len(value) > MAX_CELL_CHARS:
            raise EngineError(422, "value_too_long", f"'{name}' is longer than {MAX_CELL_CHARS:,} characters.")
        if value.strip() == "" and t != "text":
            return None
    if t == "text":
        return value if isinstance(value, str) else (str(value).lower() if isinstance(value, bool) else str(value))
    if t == "number":
        if isinstance(value, bool):
            raise EngineError(422, "invalid_value", f"'{name}' must be a number.")
        if isinstance(value, (int, float)):
            return value
        s = str(value).strip().replace(",", "")
        if re.match(r"^-?\d+$", s) and len(s) < 16:
            return int(s)
        if re.match(r"^-?\d*\.?\d+(e-?\d+)?$", s, re.I):
            return float(s)
        raise EngineError(422, "invalid_value", f"'{name}' must be a number (got '{str(value)[:40]}').")
    if t == "boolean":
        if isinstance(value, bool):
            return value
        s = str(value).strip().lower()
        if s in TRUE:
            return True
        if s in FALSE:
            return False
        raise EngineError(422, "invalid_value", f"'{name}' must be true or false.")
    s = str(value).strip()
    if t == "email":
        if not EMAIL_RE.match(s) or len(s) > 320:
            raise EngineError(422, "invalid_value", f"'{name}' must be an email address.")
        return s
    if t == "url":
        if not re.match(r"^https?://\S+$", s) or len(s) > 2000:
            raise EngineError(422, "invalid_value", f"'{name}' must be a web address starting with http:// or https://.")
        return s
    if t == "phone":
        if not PHONE_RE.match(s):
            raise EngineError(422, "invalid_value", f"'{name}' must be a phone number.")
        return s
    if t == "date":
        try:
            return date.fromisoformat(s[:10]).isoformat() if len(s) == 10 else _bad(name, "a date like 2026-11-21")
        except ValueError:
            _bad(name, "a date like 2026-11-21")
    if t == "datetime":
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat().replace("+00:00", "Z")
        except ValueError:
            _bad(name, "a date and time like 2026-11-21T14:30:00Z")
    return s


def _bad(name: str, what: str):
    raise EngineError(422, "invalid_value", f"'{name}' must be {what}.")


def clean_row(table: SheetTable, data: dict, *, partial: bool, strict: bool = True) -> dict:
    """Validate a record. strict=False (website forms) silently drops unknown fields."""
    if not isinstance(data, dict):
        raise EngineError(422, "invalid_row", "Each row must be a JSON object, like {\"name\": \"Ann\"}.")
    by_key = {c["name"].lower(): c for c in table.columns}
    out: dict = {}
    for k, v in data.items():
        key = str(k).lower()
        if key in SYSTEM or str(k).startswith("_"):
            continue  # id / timestamps are ours; _gotcha etc. are form helpers
        col = by_key.get(key)
        if col is None:
            if strict:
                raise EngineError(
                    422,
                    "unknown_column",
                    f"'{str(k)[:60]}' isn't a column of '{table.name}'. Columns: {', '.join(c['name'] for c in table.columns) or 'none yet'}.",
                )
            continue
        out[col["name"]] = coerce(col, v)
    if not partial and not strict and not out and data:
        raise EngineError(422, "no_matching_fields",
                          f"None of the form's fields match the columns of '{table.name}': "
                          f"{', '.join(c['name'] for c in table.columns) or 'no columns yet'}.")
    for c in table.columns:
        if c.get("required") and (not partial or c["name"] in out) and out.get(c["name"]) in (None, ""):
            raise EngineError(422, "missing_value", f"'{c['name']}' is required.")
    return out


def row_view(r: SheetRow) -> dict:
    return {"id": r.row_id, **(r.data or {}), "created_at": r.created_at or None, "updated_at": r.updated_at or None}


# ====================================================================== header helpers
def _header_layout(header: list) -> dict:
    """Index of every header name (lower-case), ignoring blanks."""
    out = {}
    for i, h in enumerate(header):
        name = str(h).strip()
        if name and name.lower() not in out:
            out[name.lower()] = i
    return out


def _user_columns_from_header(header: list, known: list[dict]) -> list[dict]:
    types = {c["name"].lower(): c for c in known}
    cols, seen = [], set()
    for h in header:
        name = str(h).strip()
        if not name or name.lower() in SYSTEM or name.lower() in seen:
            continue
        seen.add(name.lower())
        k = types.get(name.lower())
        cols.append({"name": name, "type": k["type"] if k else "text", "required": bool(k and k.get("required"))})
    return cols


def _cell(v):
    return "" if v is None else v


def _norm(v):
    if isinstance(v, str) and v == "":
        return None
    return v


# ====================================================================== refresh (Google -> our copy)
def needs_refresh(table: SheetTable) -> bool:
    r = aware(table.refreshed_at)
    return r is None or (now() - r).total_seconds() > settings.SHEETS_CACHE_SECONDS


def has_pending(db: Session, table_id: str) -> bool:
    return bool(db.scalar(select(func.count()).select_from(SheetOp).where(SheetOp.table_id == table_id, SheetOp.status == "pending")))


def _read_tab(db: Session, database: SheetDatabase, table: SheetTable, a1_suffix: str = "") -> list[list]:
    """Read a tab by name; if someone renamed the tab in Google, find it again by its id."""
    c = client(db, database)
    try:
        return c.get_values(database.spreadsheet_id, quote_tab(table.name) + a1_suffix)
    except SheetsError as exc:
        if isinstance(exc, (SheetsAuthError,)) or exc.status not in (400, 404):
            raise
    info = c.get(database.spreadsheet_id)
    tab = info.tab_by_gid(table.sheet_gid)
    if tab is None:
        raise EngineError(410, "tab_deleted", f"The tab '{table.name}' was deleted from the spreadsheet.")
    if tab.title != table.name:
        event(db, database, "table_renamed", f"Tab '{table.name}' was renamed to '{tab.title}' in Google Sheets.")
        table.name = tab.title
        table.name_key = tab.title.lower()
        db.commit()
    return c.get_values(database.spreadsheet_id, quote_tab(table.name) + a1_suffix)


def refresh_table(db: Session, database: SheetDatabase, table: SheetTable, *, force: bool = False) -> bool:
    """Re-read the tab from Google. Returns True if our copy is now fresh."""
    if not force and not needs_refresh(table):
        return True
    if has_pending(db, table.id):
        return False  # our copy already shows the queued changes; Google catches up after the flush
    if database.status not in ("active",):
        return False
    if not claim(db, database.id, wait=2.0 if force else 0.0):
        return False
    try:
        return _refresh_claimed(db, database, table)
    finally:
        release(db, database.id)


def _refresh_claimed(db: Session, database: SheetDatabase, table: SheetTable) -> bool:
    last_op = db.scalar(select(func.max(SheetOp.id)).where(SheetOp.table_id == table.id)) or 0
    values = _read_tab(db, database, table)
    header = [str(h).strip() for h in (values[0] if values else [])]
    layout = _header_layout(header)
    c = client(db, database)
    tab = quote_tab(table.name)

    if not any(header):
        # Header row was cleared by hand: write it back from what we know.
        header = ["id", *[col["name"] for col in table.columns], "created_at", "updated_at"]
        c.update_values(database.spreadsheet_id, [(f"{tab}!A1", [header])], wait=5)
        event(db, database, "repaired", f"The header row of '{table.name}' was empty; ThumbsUp wrote it again.")
        layout = _header_layout(header)
        values = [header] + values[1:]

    if "id" not in layout:
        # No id column (an existing sheet, or someone deleted it): add one at the END, so the
        # customer's own layout doesn't move.
        idx = len(header)
        c.batch_update(database.spreadsheet_id, [
            {"insertDimension": {"range": {"sheetId": table.sheet_gid, "dimension": "COLUMNS", "startIndex": idx, "endIndex": idx + 1},
                                 "inheritFromBefore": idx > 0}},
        ], wait=5)
        c.update_values(database.spreadsheet_id, [(f"{tab}!{col_letter(idx)}1", [["id"]])], wait=5)
        header.append("id")
        layout["id"] = idx
        event(db, database, "repaired", f"Added an 'id' column to '{table.name}' so rows can be updated and deleted.")

    id_i = layout["id"]
    rows, fixes, seen = [], [], set()
    for n, raw in enumerate(values[1:], start=2):
        if not any(v not in ("", None) for v in raw):
            continue  # empty line
        rid = str(raw[id_i]).strip() if id_i < len(raw) else ""
        if not rid or rid in seen or len(rid) > 40:
            rid = new_row_id()  # typed by hand, or copy-pasted: give it its own id
            fixes.append((f"{tab}!{col_letter(id_i)}{n}", [[rid]]))
        seen.add(rid)
        data = {}
        for name, i in layout.items():
            if name in SYSTEM:
                continue
            data[header[i]] = _norm(raw[i]) if i < len(raw) else None
        rows.append({
            "row_id": rid, "position": n, "data": data,
            "created_at": str(raw[layout["created_at"]]) if "created_at" in layout and layout["created_at"] < len(raw) else "",
            "updated_at": str(raw[layout["updated_at"]]) if "updated_at" in layout and layout["updated_at"] < len(raw) else "",
        })
    if fixes:
        c.update_values(database.spreadsheet_id, fixes, wait=5)

    # Only replace our copy if no new write arrived while we were reading Google.
    newer = db.scalar(select(func.max(SheetOp.id)).where(SheetOp.table_id == table.id)) or 0
    if newer != last_op or has_pending(db, table.id):
        return False
    old_cols = {c_["name"].lower() for c_ in table.columns}
    table.columns = _user_columns_from_header(header, table.columns)
    new_cols = {c_["name"].lower() for c_ in table.columns}
    if old_cols != new_cols:
        added = new_cols - old_cols
        removed = old_cols - new_cols
        msg = []
        if added:
            msg.append("added " + ", ".join(sorted(added)))
        if removed:
            msg.append("removed " + ", ".join(sorted(removed)))
        event(db, database, "columns_changed", f"Columns of '{table.name}' were changed in Google Sheets: {'; '.join(msg)}.")
    db.execute(delete(SheetRow).where(SheetRow.table_id == table.id))
    for r in rows[: settings.SHEETS_MAX_ROWS_PER_TABLE]:
        db.add(SheetRow(table_id=table.id, user_id=table.user_id, **r))
    table.row_count = min(len(rows), settings.SHEETS_MAX_ROWS_PER_TABLE)
    table.refreshed_at = now()
    database.last_synced_at = now()
    db.commit()
    return True


# ====================================================================== writes (queued)
def queue_insert(db: Session, database: SheetDatabase, table: SheetTable, records: list[dict], strict: bool = True) -> tuple[list[SheetRow], list[int]]:
    _writable(database)
    if table.row_count + len(records) > settings.SHEETS_MAX_ROWS_PER_TABLE:
        raise EngineError(409, "table_full", f"'{table.name}' can hold at most {settings.SHEETS_MAX_ROWS_PER_TABLE:,} rows.")
    cleaned = [clean_row(table, r, partial=False, strict=strict) for r in records]  # all-or-nothing
    ts = stamp()
    pos = (db.scalar(select(func.max(SheetRow.position)).where(SheetRow.table_id == table.id)) or 1) + 1
    rows, op_ids = [], []
    for data in cleaned:
        rid = new_row_id()
        full = {c["name"]: data.get(c["name"]) for c in table.columns}
        row = SheetRow(table_id=table.id, user_id=table.user_id, row_id=rid, position=pos, data=full, created_at=ts, updated_at=ts)
        pos += 1
        db.add(row)
        op = SheetOp(database_id=database.id, table_id=table.id, user_id=table.user_id, op="insert", row_id=rid,
                     data={**full, "created_at": ts, "updated_at": ts})
        db.add(op)
        rows.append(row)
        op_ids.append(op)
    table.row_count += len(rows)
    db.commit()
    wake()
    return rows, [o.id for o in op_ids]


def get_row(db: Session, table: SheetTable, row_id: str) -> SheetRow:
    r = db.scalar(select(SheetRow).where(SheetRow.table_id == table.id, SheetRow.row_id == row_id))
    if r is None:
        raise EngineError(404, "row_not_found", f"Row '{row_id[:40]}' not found in '{table.name}'.")
    return r


def queue_update(db: Session, database: SheetDatabase, table: SheetTable, row_id: str, changes: dict) -> tuple[SheetRow, int]:
    _writable(database)
    row = get_row(db, table, row_id)
    cleaned = clean_row(table, changes, partial=True)
    if not cleaned:
        raise EngineError(422, "nothing_to_update", "Send at least one column to change.")
    ts = stamp()
    row.data = {**(row.data or {}), **cleaned}
    row.updated_at = ts
    op = SheetOp(database_id=database.id, table_id=table.id, user_id=table.user_id, op="update", row_id=row.row_id,
                 data={**cleaned, "updated_at": ts})
    db.add(op)
    db.commit()
    wake()
    return row, op.id


def queue_delete(db: Session, database: SheetDatabase, table: SheetTable, row_id: str) -> int:
    _writable(database)
    row = get_row(db, table, row_id)
    op = SheetOp(database_id=database.id, table_id=table.id, user_id=table.user_id, op="delete", row_id=row.row_id, data={})
    db.add(op)
    db.delete(row)
    table.row_count = max(0, table.row_count - 1)
    db.commit()
    wake()
    return op.id


def _writable(database: SheetDatabase) -> None:
    if database.status == "needs_verification":
        raise EngineError(409, "needs_verification", "Verify this sheet first (see the dashboard).")
    if database.status == "no_access":
        # Writes are kept for when access comes back? No: refuse new ones so the developer sees the problem.
        raise EngineError(409, "no_access", database.last_error or "ThumbsUp lost access to this spreadsheet.")


def wait_for(db: Session, op_ids: list[int], timeout: float = 15.0) -> bool:
    """Wait until these queued writes reached Google (used by ?wait=true)."""
    if not op_ids:
        return True
    deadline = time.monotonic() + timeout
    while True:
        db.expire_all()
        pending = db.scalar(
            select(func.count()).select_from(SheetOp).where(SheetOp.id.in_(op_ids), SheetOp.status == "pending")
        )
        if not pending:
            failed = db.scalar(select(func.count()).select_from(SheetOp).where(SheetOp.id.in_(op_ids), SheetOp.status == "failed"))
            return not failed
        if time.monotonic() >= deadline:
            return False
        if not worker_running():
            flush_due(force=True)
            continue
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.2)


# ====================================================================== flush (our queue -> Google)
def _coalesce(ops: list[SheetOp]) -> dict[str, dict]:
    """Many queued ops for the same row become one: insert+update = insert, insert+delete = nothing."""
    out: dict[str, dict] = {}
    for o in ops:
        cur = out.get(o.row_id)
        if o.op == "insert":
            out[o.row_id] = {"op": "insert", "data": dict(o.data)}
        elif o.op == "update":
            if cur is None:
                out[o.row_id] = {"op": "update", "data": dict(o.data)}
            elif cur["op"] in ("insert", "update"):
                cur["data"].update(o.data)
        elif o.op == "delete":
            if cur is not None and cur["op"] == "insert":
                out[o.row_id] = {"op": "noop", "data": {}}
            else:
                out[o.row_id] = {"op": "delete", "data": {}}
    return out


def flush_database(database_id: str) -> None:
    with SessionLocal() as db:
        database = db.get(SheetDatabase, database_id)
        if database is None or not claim(db, database_id):
            return
        try:
            _flush_claimed(db, database)
        finally:
            release(db, database_id)


def _flush_claimed(db: Session, database: SheetDatabase) -> None:
    due = now()
    ops = list(db.scalars(
        select(SheetOp)
        .where(SheetOp.database_id == database.id, SheetOp.status == "pending")
        .where((SheetOp.next_attempt_at.is_(None)) | (SheetOp.next_attempt_at <= due))
        .order_by(SheetOp.id)
        .limit(5000)
    ))
    if not ops:
        return
    by_table: dict[str, list[SheetOp]] = {}
    for o in ops:
        by_table.setdefault(o.table_id, []).append(o)
    for table_id, table_ops in by_table.items():
        table = db.get(SheetTable, table_id)
        try:
            notes = _flush_table(db, database, table, table_ops)
            for o in table_ops:
                o.status, o.done_at, o.error = "done", now(), None
            for n in notes:
                event(db, database, "sync_note", n)
            if database.status == "error":
                database.status, database.last_error = "active", None
            database.last_synced_at = now()
            db.commit()
        except (SheetsAuthError, SheetsAccessError) as exc:
            db.rollback()
            msg = (
                "The Google account was disconnected. Reconnect it in ThumbsUp."
                if isinstance(exc, SheetsAuthError)
                else "ThumbsUp can't open this spreadsheet any more (deleted, or access removed)."
            )
            database.status, database.last_error = "no_access", msg
            event(db, database, "access_lost", msg)
            for o in table_ops:  # keep them: they are written as soon as access comes back
                o.next_attempt_at = now() + timedelta(minutes=5)
            if isinstance(exc, SheetsAuthError) and database.connection_id:
                conn = db.get(SheetConnection, database.connection_id)
                if conn:
                    conn.status, conn.last_error = "revoked", msg
            db.commit()
            return
        except (SheetsError, EngineError) as exc:
            db.rollback()
            temporary = isinstance(exc, SheetsError) and exc.temporary
            for o in table_ops:
                o.attempts += 1
                o.error = str(exc)[:500]
                if temporary and o.attempts < MAX_ATTEMPTS:
                    o.next_attempt_at = now() + timedelta(seconds=min(5 * 2 ** o.attempts, 600) + random.uniform(0, 2))
                else:
                    o.status = "failed"
            if not temporary or table_ops[0].attempts >= MAX_ATTEMPTS:
                event(db, database, "sync_error", f"Couldn't write to '{table.name}': {exc}")
                table.refreshed_at = None  # show Google's real state again
            db.commit()


def _flush_table(db: Session, database: SheetDatabase, table: SheetTable, ops: list[SheetOp]) -> list[str]:
    plan = _coalesce(ops)
    inserts = [(rid, p["data"]) for rid, p in plan.items() if p["op"] == "insert"]
    updates = {rid: p["data"] for rid, p in plan.items() if p["op"] == "update"}
    deletes = {rid for rid, p in plan.items() if p["op"] == "delete"}
    if not (inserts or updates or deletes):
        return []
    c = client(db, database)
    tab = quote_tab(table.name)
    notes: list[str] = []

    values = _read_tab(db, database, table, "" if (updates or deletes) else "!1:1")
    header = [str(h).strip() for h in (values[0] if values else [])]
    layout = _header_layout(header)
    if "id" not in layout:
        table.refreshed_at = None
        raise SheetsError("The 'id' column is missing in the sheet; ThumbsUp is repairing it.", temporary=True)
    id_i = layout["id"]
    width = len(header)
    tab = quote_tab(table.name)  # may have been renamed by _read_tab

    def build(data: dict, base: list | None = None) -> list:
        row = list(base or []) + [""] * (width - len(base or []))
        for key, v in data.items():
            i = layout.get(str(key).lower())
            if i is not None:
                row[i] = _cell(v)
        return row[:width]

    # 1) updates (before deletes: row numbers are still right)
    positions = {}
    if updates or deletes:
        for n, raw in enumerate(values[1:], start=2):
            rid = str(raw[id_i]).strip() if id_i < len(raw) else ""
            if rid:
                positions.setdefault(rid, (n, raw))
    upd_data = []
    for rid, data in updates.items():
        found = positions.get(rid)
        if not found:
            notes.append(f"Row {rid} in '{table.name}' was deleted in Google Sheets before an update reached it.")
            continue
        n, raw = found
        upd_data.append((f"{tab}!A{n}:{col_letter(width - 1)}{n}", [build(data, [_cell(v) for v in raw])]))
    c.update_values(database.spreadsheet_id, upd_data)

    # 2) deletes: bottom-up so row numbers don't shift under us
    rows_to_delete = sorted({positions[rid][0] for rid in deletes if rid in positions}, reverse=True)
    if rows_to_delete:
        data_rows = sum(1 for raw in values[1:] if any(v not in ("", None) for v in raw))
        requests = []
        keep_one = len(rows_to_delete) >= data_rows  # Google refuses to delete every row below a frozen header
        for n in rows_to_delete:
            if keep_one and n == min(rows_to_delete):
                requests.append({"updateCells": {"range": {"sheetId": table.sheet_gid, "startRowIndex": n - 1, "endRowIndex": n},
                                                 "fields": "userEnteredValue"}})
            else:
                requests.append({"deleteDimension": {"range": {"sheetId": table.sheet_gid, "dimension": "ROWS",
                                                               "startIndex": n - 1, "endIndex": n}}})
        c.batch_update(database.spreadsheet_id, requests)

    # 3) inserts
    if inserts:
        rows = []
        for rid, data in inserts:
            rows.append(build({**data, "id": rid}))
        c.append_rows(database.spreadsheet_id, f"{tab}!A1", rows)
    return notes


# ====================================================================== schema changes
def apply_changes(db: Session, database: SheetDatabase, changes: list[dict], *, source: str, name: str | None = None,
                  dry_run: bool = False) -> dict:
    """Plan and apply schema changes. Returns {"steps": [...], "applied": bool, "skipped": bool}."""
    if database.status != "active":
        raise EngineError(409, database.status, database.last_error or "This spreadsheet isn't ready.")
    if name:
        done = db.scalar(select(SheetMigration).where(SheetMigration.database_id == database.id, SheetMigration.name == name))
        if done:
            return {"steps": [], "descriptions": [], "applied": False, "skipped": True, "migration": name}
    tables = list(db.scalars(select(SheetTable).where(SheetTable.database_id == database.id)))
    current = {t.name: t.columns for t in tables}
    try:
        steps = sheet_schema.plan(changes, current, settings.SHEETS_MAX_TABLES, settings.SHEETS_MAX_COLUMNS)
    except sheet_schema.SchemaError as exc:
        raise EngineError(422, "invalid_schema", str(exc)) from exc
    descriptions = [sheet_schema.describe(s) for s in steps]
    if dry_run or not steps:
        if not dry_run and name and not steps:
            db.add(SheetMigration(database_id=database.id, user_id=database.user_id, name=name, source=source, changes=[]))
            db.commit()
        return {"steps": steps, "descriptions": descriptions, "applied": False, "skipped": False, "migration": name}

    if not claim(db, database.id, wait=15):
        raise EngineError(409, "busy", "This spreadsheet is busy (writes are being sent). Try again in a few seconds.")
    try:
        _flush_claimed(db, database)  # queued writes go first, with the old column names
        db.expire_all()
        if db.scalar(select(func.count()).select_from(SheetOp).where(SheetOp.database_id == database.id, SheetOp.status == "pending")):
            raise EngineError(409, "writes_pending", "Some writes are still waiting for Google. Try again in a minute.")
        _apply_claimed(db, database, steps)
        db.add(SheetMigration(
            database_id=database.id, user_id=database.user_id,
            name=name or f"{source}-{now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3)}",
            source=source, changes=steps,
        ))
        event(db, database, "schema_changed", "; ".join(descriptions)[:1000])
        db.commit()
    finally:
        release(db, database.id)
    return {"steps": steps, "descriptions": descriptions, "applied": True, "skipped": False, "migration": name}


def _apply_claimed(db: Session, database: SheetDatabase, steps: list[dict]) -> None:
    c = client(db, database)
    tables = {t.name_key: t for t in db.scalars(select(SheetTable).where(SheetTable.database_id == database.id))}

    # Fresh headers of every table we touch (1 read for all of them).
    touched = {s["table"].lower() for s in steps if s["op"] != "create_table"} & set(tables)
    headers: dict[str, list[str]] = {}
    for key in touched:
        t = tables[key]
        values = _read_tab(db, database, t, "!1:1")
        headers[key] = [str(h).strip() for h in (values[0] if values else [])]

    requests: list[dict] = []
    new_tables: list[SheetTable] = []
    info = None

    def find(h: list[str], name: str) -> int:
        for i, x in enumerate(h):
            if x.lower() == name.lower():
                return i
        raise EngineError(409, "column_missing", f"Column '{name}' isn't in the sheet's header any more. Refresh and try again.")

    def user_positions(h: list[str]) -> list[int]:
        return [i for i, x in enumerate(h) if x and x.lower() not in SYSTEM]

    for s in steps:
        key = s["table"].lower()
        op = s["op"]
        if op == "create_table":
            gid = random.randint(10_000, 2_000_000_000)
            header = ["id", *[col["name"] for col in s["columns"]], "created_at", "updated_at"]
            requests.append({"addSheet": {"properties": {"sheetId": gid, "title": s["table"],
                             "gridProperties": {"rowCount": 1000, "columnCount": max(len(header), 5), "frozenRowCount": 1}}}})
            requests.append(_header_cells(gid, 0, header))
            t = SheetTable(database_id=database.id, user_id=database.user_id, name=s["table"], name_key=key,
                           sheet_gid=gid, columns=s["columns"], refreshed_at=now())
            tables[key] = t
            headers[key] = header
            new_tables.append(t)
            continue
        t = tables[key]
        h = headers[key]
        if op == "add_column":
            ups = user_positions(h)
            pos = s.get("position")
            if pos is not None and pos < len(ups):
                idx = ups[pos]
            elif ups:
                idx = ups[-1] + 1
            else:
                idx = (h.index("id") + 1) if "id" in [x.lower() for x in h] else 0
            requests.append({"insertDimension": {"range": {"sheetId": t.sheet_gid, "dimension": "COLUMNS",
                                                           "startIndex": idx, "endIndex": idx + 1}, "inheritFromBefore": idx > 0}})
            requests.append(_header_cells(t.sheet_gid, idx, [s["column"]["name"]]))
            h.insert(idx, s["column"]["name"])
            cols = list(t.columns)
            p = pos if pos is not None and pos <= len(cols) else len(cols)
            cols.insert(p, s["column"])
            t.columns = cols
        elif op == "drop_column":
            idx = find(h, s["column"])
            requests.append({"deleteDimension": {"range": {"sheetId": t.sheet_gid, "dimension": "COLUMNS",
                                                           "startIndex": idx, "endIndex": idx + 1}}})
            h.pop(idx)
            t.columns = [col for col in t.columns if col["name"].lower() != s["column"].lower()]
            _rewrite_rows(db, t, lambda d, n=s["column"]: {k: v for k, v in d.items() if k.lower() != n.lower()})
        elif op == "rename_column":
            idx = find(h, s["column"])
            requests.append(_header_cells(t.sheet_gid, idx, [s["to"]]))
            h[idx] = s["to"]
            t.columns = [{**col, "name": s["to"]} if col["name"].lower() == s["column"].lower() else col for col in t.columns]
            _rewrite_rows(db, t, lambda d, a=s["column"], b=s["to"]: {(b if k.lower() == a.lower() else k): v for k, v in d.items()})
        elif op == "move_column":
            idx = find(h, s["column"])
            ups = user_positions(h)
            target = ups[min(s["position"], len(ups) - 1)]
            if target != idx:
                dest = target + 1 if target > idx else target
                requests.append({"moveDimension": {"source": {"sheetId": t.sheet_gid, "dimension": "COLUMNS",
                                                              "startIndex": idx, "endIndex": idx + 1}, "destinationIndex": dest}})
                h.insert(target, h.pop(idx))
            cols = [col for col in t.columns if col["name"].lower() != s["column"].lower()]
            moved = next(col for col in t.columns if col["name"].lower() == s["column"].lower())
            cols.insert(min(s["position"], len(cols)), moved)
            t.columns = cols
        elif op == "alter_column":
            t.columns = [{**col, "type": s["type"], "required": s["required"]} if col["name"].lower() == s["column"].lower() else col
                         for col in t.columns]
        elif op == "rename_table":
            requests.append({"updateSheetProperties": {"properties": {"sheetId": t.sheet_gid, "title": s["to"]}, "fields": "title"}})
            t.name, t.name_key = s["to"], s["to"].lower()
            del tables[key]
            tables[s["to"].lower()] = t
            headers[s["to"].lower()] = h
        elif op == "drop_table":
            requests.append({"deleteSheet": {"sheetId": t.sheet_gid}})
            db.delete(t)
            del tables[key]

    dropped = sum(1 for s in steps if s["op"] == "drop_table")
    if dropped:
        info = c.get(database.spreadsheet_id)
        if len(info.tabs) - dropped + len(new_tables) <= 0:
            # Google needs at least one tab in a spreadsheet
            requests.insert(0, {"addSheet": {"properties": {"title": "Sheet1"}}})

    # A new spreadsheet starts with an empty "Sheet1": remove it once the first real table exists.
    if new_tables:
        info = c.get(database.spreadsheet_id)
        existing = {tb.gid for tb in info.tabs}
        placeholder = [tb for tb in info.tabs if tb.title == "Sheet1" and tb.gid not in {t.sheet_gid for t in tables.values()}]
        if placeholder and len(existing) == 1 and not db.scalar(
            select(func.count()).select_from(SheetTable).where(SheetTable.database_id == database.id, SheetTable.sheet_gid == placeholder[0].gid)
        ):
            requests.append({"deleteSheet": {"sheetId": placeholder[0].gid}})
        taken = {tb.title.lower() for tb in info.tabs}
        for t in new_tables:
            if t.name_key in taken:
                raise EngineError(409, "tab_exists", f"The spreadsheet already has a tab called '{t.name}'. Pick another table name.")

    c.batch_update(database.spreadsheet_id, requests, wait=15)
    for t in new_tables:
        db.add(t)
    db.commit()


def _header_cells(gid: int, col: int, names: list[str]) -> dict:
    return {
        "updateCells": {
            "start": {"sheetId": gid, "rowIndex": 0, "columnIndex": col},
            "rows": [{"values": [{"userEnteredValue": {"stringValue": n}, "userEnteredFormat": {"textFormat": {"bold": True}}}
                                 for n in names]}],
            "fields": "userEnteredValue,userEnteredFormat.textFormat.bold",
        }
    }


def _rewrite_rows(db: Session, table: SheetTable, fn) -> None:
    for r in db.scalars(select(SheetRow).where(SheetRow.table_id == table.id)):
        r.data = fn(dict(r.data or {}))


# ====================================================================== connecting a spreadsheet
def adopt_tabs(db: Session, database: SheetDatabase) -> int:
    """Existing spreadsheet: every tab with a header row becomes a table."""
    c = client(db, database)
    info = c.get(database.spreadsheet_id)
    database.spreadsheet_title = info.title[:255]
    count = 0
    for tab in info.tabs[: settings.SHEETS_MAX_TABLES]:
        if not sheet_schema.TABLE_RE.match(tab.title):
            event(db, database, "skipped_tab", f"Tab '{tab.title[:60]}' was skipped: its name has characters ThumbsUp can't use.")
            continue
        values = c.get_values(database.spreadsheet_id, quote_tab(tab.title) + "!1:1")
        header = [str(h).strip() for h in (values[0] if values else [])]
        if not any(header):
            continue
        db.add(SheetTable(database_id=database.id, user_id=database.user_id, name=tab.title, name_key=tab.title.lower(),
                          sheet_gid=tab.gid, columns=_user_columns_from_header(header, [])))
        count += 1
    db.commit()
    return count


# ====================================================================== worker
_worker: threading.Thread | None = None
_stop = threading.Event()
_wake = threading.Event()


def worker_running() -> bool:
    return _worker is not None and _worker.is_alive()


def wake() -> None:
    _wake.set()


def flush_due(force: bool = False) -> int:
    with SessionLocal() as db:
        q = select(SheetOp.database_id).where(SheetOp.status == "pending")
        if not force:
            q = q.where((SheetOp.next_attempt_at.is_(None)) | (SheetOp.next_attempt_at <= now()))
        ids = list(db.scalars(q.distinct().limit(200)))
        if force:
            db.execute(update(SheetOp).where(SheetOp.status == "pending").values(next_attempt_at=None))
            db.commit()
    for i in ids:
        try:
            flush_database(i)
        except Exception:  # noqa: BLE001
            log.exception("sheets flush failed for %s", i)
    return len(ids)


def _loop() -> None:
    log.info("Sheets writer started")
    while not _stop.is_set():
        _wake.wait(timeout=2.0)
        _wake.clear()
        time.sleep(0.5)  # gather a few more writes into the same batch
        try:
            flush_due()
        except Exception:  # noqa: BLE001
            log.exception("sheets worker error")


def start_worker() -> None:
    global _worker
    if worker_running():
        return
    _stop.clear()
    _worker = threading.Thread(target=_loop, name="sheets-writer", daemon=True)
    _worker.start()


def stop_worker() -> None:
    _stop.set()
    _wake.set()
