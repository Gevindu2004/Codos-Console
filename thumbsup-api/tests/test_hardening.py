"""Attack scenarios found in the security review. Each one must be blocked."""

import json

import pytest
from conftest import SITE, make_user
from fake_drive import FakeDrive
from fastapi.testclient import TestClient

from app.main import app
from app.services import asset_sync, drive
from app.services.asset_storage import reset_storage


def secret(c):
    return c.post("/dashboard/keys", json={"name": "s", "kind": "secret"}).json()["data"]["key"]


# ---------------------------------------------------------------- 1. CSRF
def test_dashboard_rejects_requests_from_other_websites(alice):
    """A page on another site (or another port/subdomain = 'same-site') must not act as the user."""
    r = alice.post("/dashboard/keys", json={"name": "x", "kind": "secret"}, headers={"Origin": "http://localhost:5500"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "bad_origin"
    r = alice.post("/dashboard/emails/test", data={"to": "victim@example.com", "subject": "s", "text": "t"},
                   headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    # the real console is fine, and so are tools that send no Origin (curl, server scripts)
    assert alice.post("/dashboard/keys", json={"name": "x", "kind": "secret"}, headers={"Origin": "http://localhost:3000"}).status_code == 201
    assert alice.get("/dashboard/keys", headers={"Origin": "https://evil.example"}).status_code == 200  # reads are harmless (CORS hides them)


# ---------------------------------------------------------------- 2. sessions
def test_logout_kills_the_session_token(client, alice):
    cookie = alice.cookies.get("tu_session")
    alice.post("/dashboard/auth/logout")
    stolen = TestClient(app)
    stolen.cookies.set("tu_session", cookie)
    assert stolen.get("/dashboard/auth/me").status_code == 401


def test_password_reset_logs_out_everywhere(client, alice):
    import glob
    import os
    import re

    old_cookie = alice.cookies.get("tu_session")
    client.post("/dashboard/auth/password/forgot", json={"email": "alice@example.com"})
    path = sorted(glob.glob(os.path.join(os.environ["STORAGE_DIR"], "outbox", "sys_*.eml")), key=os.path.getmtime)[-1]
    code = re.search(r"Subject: (\d{6})", open(path).read()).group(1)
    assert client.post("/dashboard/auth/password/reset", json={"email": "alice@example.com", "code": code, "password": "newpass123"}).status_code == 200
    thief = TestClient(app)
    thief.cookies.set("tu_session", old_cookie)
    assert thief.get("/dashboard/auth/me").status_code == 401


# ---------------------------------------------------------------- 3. huge requests (memory exhaustion)
def test_oversized_body_rejected_before_reading(client, alice):
    key = secret(alice)
    huge = "A" * (60 * 1024 * 1024)
    r = client.post("/v1/emails", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    content=json.dumps({"to": "a@example.com", "subject": "s", "text": huge}))
    assert r.status_code == 413 and r.json()["error"]["code"] == "request_too_large"


# ---------------------------------------------------------------- 4. header injection through names
def test_newlines_in_sender_name_cannot_inject_headers(client, alice):
    r = client.post("/v1/emails", headers={"Authorization": f"Bearer {secret(alice)}"},
                    json={"to": "a@example.com", "subject": "s", "text": "t", "from_name": "Shop\r\nBcc: victim@example.org"})
    assert r.status_code == 202
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert email["status"] == "sent" and "\n" not in email["from"] and email["bcc"] == []


# ---------------------------------------------------------------- 5. auto-reply spam ("backscatter")
def test_auto_reply_cannot_be_used_to_spam_strangers(client, alice):
    pk = alice.post("/dashboard/keys", json={"name": "Site", "kind": "public", "allowed_origins": [SITE]}).json()["data"]["key"]
    t = alice.post("/dashboard/templates", json={
        "name": "Contact", "subject": "Msg from {{name}}", "text": "{{message}}", "to_emails": ["owner@shop.example.com"],
        "allow_public": True, "auto_reply": True, "auto_reply_subject": "Thanks {{name}}", "auto_reply_text": "Hi {{name}}, thanks!"}).json()["data"]
    spam_name = "CHEAP PILLS at http://spam.example/buy now " * 5
    for _ in range(3):
        client.post("/v1/forms/send", headers={"Origin": SITE},
                    data={"public_key": pk, "template_id": t["id"], "name": spam_name, "email": "victim@example.org"})
    replies = [e for e in alice.get("/dashboard/emails?source=auto_reply").json()["data"]]
    assert len(replies) == 1  # at most one auto-reply per address per day
    full = alice.get(f"/dashboard/emails/{replies[0]['id']}").json()["data"]
    assert "http" not in full["text"] and "spam.example" not in full["subject"] and len(full["subject"]) < 120


# ---------------------------------------------------------------- 6. distributed password guessing
def test_account_locks_after_many_failed_logins_from_many_ips(client, alice, monkeypatch):
    from app import deps

    ips = iter(f"10.0.0.{i}" for i in range(1, 200))
    monkeypatch.setattr(deps, "client_ip", lambda request: next(ips))
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router, "client_ip", lambda request: next(ips))
    codes = [client.post("/dashboard/auth/login", json={"email": "alice@example.com", "password": f"guess{i}x"}).status_code for i in range(25)]
    assert 429 in codes
    # the real owner sees a clear message, not a silent failure
    r = client.post("/dashboard/auth/login", json={"email": "alice@example.com", "password": "secret123"})
    assert r.status_code == 429 and "try again" in r.json()["error"]["message"].lower()


# ---------------------------------------------------------------- 7. spoofed X-Forwarded-For
def test_rate_limits_cannot_be_dodged_with_fake_forwarded_for(monkeypatch):
    from starlette.requests import Request

    from app.config import settings
    from app.deps import client_ip

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    req = Request({"type": "http", "headers": [(b"x-forwarded-for", b"6.6.6.6, 203.0.113.9")], "client": ("172.18.0.2", 1)})
    assert client_ip(req) == "203.0.113.9"  # the address our own proxy saw, not the one the client typed


# ---------------------------------------------------------------- 8. unauthenticated upload flood on the form endpoint
def test_form_endpoint_rate_limits_before_reading_uploads(client):
    codes = [client.post("/v1/forms/send", headers={"Origin": SITE}, files={"f": ("a.txt", b"x" * 1000, "text/plain")},
                         data={"public_key": "tu_pk_bogus"}).status_code for _ in range(40)]
    assert 429 in codes


# ---------------------------------------------------------------- 9. Drive folder hijack
@pytest.fixture
def gdrive():
    fake = FakeDrive()
    drive.set_client(fake)
    reset_storage()
    yield fake
    drive.set_client(None)


def test_someone_else_cannot_publish_a_private_folder_they_only_know_the_link_of(client, alice, gdrive):
    """A folder shared privately with the robot must not go public just because a stranger has its link."""
    victim_folder = gdrive.folder("Client private docs", share=True)
    gdrive.upload(victim_folder, "salaries.pdf", b"SECRET", "application/pdf")
    r = alice.post("/dashboard/assets/projects", json={"folder_link": victim_folder, "slug": "stolen"})
    assert r.status_code == 201
    p = r.json()["data"]
    assert alice.get(f"/dashboard/assets/projects/{p['id']}").json()["data"]["status"] == "needs_verification"
    assert client.get("/a/stolen/salaries.pdf").status_code == 404  # nothing is public until proven

    # the real owner proves control by adding the account's verification file
    gdrive.upload(victim_folder, p["verification_file"], b"", "text/plain")
    asset_sync.request_sync(p["id"])
    asset_sync.sync_project(p["id"])
    assert alice.get(f"/dashboard/assets/projects/{p['id']}").json()["data"]["status"] == "active"
    assert client.get("/a/stolen/salaries.pdf").content == b"SECRET"
    # the verification file itself is never served
    assert client.get(f"/a/stolen/{p['verification_file']}").status_code == 404


def test_verification_file_is_per_account(alice, bob, gdrive):
    a = alice.get("/dashboard/assets/config").json()["verification_file"]
    b = bob.get("/dashboard/assets/config").json()["verification_file"]
    assert a != b and a.startswith("thumbsup-verify-")


# ---------------------------------------------------------------- 10. expired big-file links are cleaned up
def test_expired_download_files_are_deleted_from_disk(client, alice):
    import base64
    import os
    from datetime import datetime, timedelta, timezone

    from app.db import SessionLocal
    from app.models import StoredFile
    from app.services import queue

    big = base64.b64encode(os.urandom(1_200_000)).decode()
    client.post("/v1/emails", headers={"Authorization": f"Bearer {secret(alice)}"},
                json={"to": "a@example.com", "subject": "s", "text": "t", "attachments": [{"filename": "big.zip", "content": big}]})
    with SessionLocal() as db:
        f = db.query(StoredFile).one()
        path = f.path
        f.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
    from app.services.asset_storage import get_storage

    assert get_storage().exists(path)
    queue.cleanup_expired()
    assert not get_storage().exists(path)
    with SessionLocal() as db:
        assert db.query(StoredFile).count() == 0


# ---------------------------------------------------------------- 11. security headers
def test_hsts_in_production(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert "max-age" in client.get("/health").headers.get("strict-transport-security", "")


def test_download_links_cannot_run_scripts(client, alice):
    import base64
    import os

    page = base64.b64encode(b"<script>alert(1)</script>" + os.urandom(1_200_000)).decode()
    r = client.post("/v1/emails", headers={"Authorization": f"Bearer {secret(alice)}"},
                    json={"to": "a@example.com", "subject": "s", "text": "t", "attachments": [{"filename": "page.html", "content": page}]})
    text = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]["text"]
    token = text.split("/v1/files/")[1].split()[0]
    dl = client.get(f"/v1/files/{token}")
    assert "sandbox" in dl.headers["content-security-policy"] and dl.headers["content-disposition"].startswith("attachment")


# ---------------------------------------------------------------- 12. automated sweep: every owned resource vs another account
def test_every_dashboard_route_with_an_id_hides_other_accounts_data(client, alice, bob, gdrive, google):
    """Create one of everything as Alice, then hit EVERY /dashboard route that takes an id as Bob."""
    key = alice.post("/dashboard/keys", json={"name": "k", "kind": "secret"}).json()["data"]
    tpl = alice.post("/dashboard/templates", json={"name": "t", "subject": "s", "text": "x"}).json()["data"]
    em = alice.post("/dashboard/emails/test", data={"to": "alice@example.com", "subject": "s", "text": "t"}).json()["data"]
    wh = alice.post("/dashboard/webhooks", json={"url": "https://hooks.example.com/x"}).json()["data"]
    alice.post("/dashboard/suppressions", json={"email": "x@example.com"})
    sup = alice.get("/dashboard/suppressions").json()["data"][0]
    folder = gdrive.folder("F", share=True)
    gdrive.upload(folder, alice.get("/dashboard/assets/config").json()["verification_file"], b"", "text/plain")
    proj = alice.post("/dashboard/assets/projects", json={"folder_link": folder}).json()["data"]
    from test_sheets import connect_google

    conn = connect_google(alice, google)
    sdb = alice.post("/dashboard/sheets/databases", json={"name": "S", "mode": "new", "connection_id": conn}).json()
    sdb = alice.post(f"/dashboard/sheets/databases/{sdb['id']}/tables", json={"name": "t", "columns": [{"name": "a"}]}).json()["database"]
    tbl = sdb["tables"][0]
    row = alice.post(f"/dashboard/sheets/tables/{tbl['id']}/rows", json={"a": "secret"}).json()["row"]
    ids = {"key_id": key["id"], "template_id": tpl["id"], "email_id": em["id"], "webhook_id": wh["id"],
           "suppression_id": sup["id"], "project_id": proj["id"], "domain_id": "dom_x", "connection_id": conn,
           "database_id": sdb["id"], "table_id": tbl["id"], "row_id": row["id"]}

    checked = 0
    for path, ops in app.openapi()["paths"].items():
        if not path.startswith("/dashboard") or "{" not in path:
            continue
        url = path
        for param in [p.split("}")[0] for p in path.split("{")[1:]]:
            url = url.replace("{" + param + "}", ids[param])
        for method in sorted(m.upper() for m in ops):
            body = {"name": "x", "subject": "x", "text": "x", "url": "https://hooks.example.com/y", "slug": "pwned",
                    "a": "pwned", "column": "a", "new_name": "b", "changes": [{"op": "drop_table", "table": "t"}]}
            r = bob.request(method, url, json=body, params={"name": "a"})
            assert r.status_code in (404, 422), f"{method} {url} returned {r.status_code} for another account"
            if r.status_code == 422:  # validation ran first: retry with a valid body must still be 404
                r = bob.request(method, url, json={"name": "x", "subject": "x", "text": "x"})
                assert r.status_code in (404, 422), f"{method} {url}"
            checked += 1
    print(f"cross-account sweep: {checked} endpoint/method combinations attacked")
    assert checked >= 40
    # and Alice's things are intact
    assert len(alice.get("/dashboard/keys").json()["data"]) == 1
    assert alice.get(f"/dashboard/assets/projects/{proj['id']}").status_code == 200
    rows = alice.get(f"/dashboard/sheets/tables/{tbl['id']}/rows").json()["rows"]
    assert rows[0]["a"] == "secret" and len(alice.get("/dashboard/sheets/connections").json()["connections"]) == 1
