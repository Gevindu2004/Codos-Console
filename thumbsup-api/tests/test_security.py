"""Security: each account only ever sees its own data, and keys are locked down."""

from conftest import SITE


def create_secret(c):
    r = c.post("/dashboard/keys", json={"name": "Server", "kind": "secret"})
    assert r.status_code == 201, r.text
    return r.json()["data"]


def create_template(c, **extra):
    body = {"name": "Contact", "subject": "New message from {{name}}", "html": "<p>{{message}}</p>", "to_emails": ["owner@shop.example.com"]}
    body.update(extra)
    r = c.post("/dashboard/templates", json=body)
    assert r.status_code == 201, r.text
    return r.json()["data"]


# ---------------------------------------------------------------- login
def test_dashboard_requires_login(client):
    for path in ("/dashboard/keys", "/dashboard/templates", "/dashboard/emails", "/dashboard/stats", "/dashboard/webhooks"):
        r = client.get(path)
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "not_logged_in"


def test_wrong_password_and_unknown_email_look_the_same(client, alice):
    a = client.post("/dashboard/auth/login", json={"email": "alice@example.com", "password": "nope12345"})
    b = client.post("/dashboard/auth/login", json={"email": "ghost@example.com", "password": "nope12345"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_session_cookie_is_httponly(client):
    r = client.post("/dashboard/auth/register", json={"name": "C", "email": "c@example.com", "password": "secret123"})
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


def test_weak_password_rejected(client):
    r = client.post("/dashboard/auth/register", json={"name": "W", "email": "w@example.com", "password": "12345678"})
    assert r.status_code == 422


def test_duplicate_email_rejected(client, alice):
    r = client.post("/dashboard/auth/register", json={"name": "A2", "email": "ALICE@example.com", "password": "secret123"})
    assert r.status_code == 409


def test_login_rate_limited(client, alice):
    codes = [
        client.post("/dashboard/auth/login", json={"email": "alice@example.com", "password": "bad-pass-1"}).status_code
        for _ in range(12)
    ]
    assert 429 in codes


# ---------------------------------------------------------------- account isolation
def test_users_cannot_see_each_others_data(alice, bob):
    key = create_secret(alice)
    tpl = create_template(alice)
    alice.post("/dashboard/emails/test", data={"to": "x@example.com", "subject": "hi", "text": "hello"})
    email_id = alice.get("/dashboard/emails").json()["data"][0]["id"]
    wh = alice.post("/dashboard/webhooks", json={"url": "https://hooks.example.com/tu"}).json()["data"]

    # Bob's lists are empty
    assert bob.get("/dashboard/keys").json()["data"] == []
    assert bob.get("/dashboard/templates").json()["data"] == []
    assert bob.get("/dashboard/emails").json()["data"] == []
    assert bob.get("/dashboard/webhooks").json()["data"] == []
    assert bob.get("/dashboard/stats").json()["counts"]["emails_all_time"] == 0

    # Bob can't read, change or delete Alice's things even with the exact ids
    assert bob.get(f"/dashboard/templates/{tpl['id']}").status_code == 404
    assert bob.put(f"/dashboard/templates/{tpl['id']}", json={"name": "x", "subject": "x", "text": "x"}).status_code == 404
    assert bob.delete(f"/dashboard/templates/{tpl['id']}").status_code == 404
    assert bob.get(f"/dashboard/emails/{email_id}").status_code == 404
    assert bob.delete(f"/dashboard/keys/{key['id']}").status_code == 404
    assert bob.patch(f"/dashboard/keys/{key['id']}", json={"name": "stolen"}).status_code == 404
    assert bob.get(f"/dashboard/webhooks/{wh['id']}/secret").status_code == 404
    assert bob.delete(f"/dashboard/webhooks/{wh['id']}").status_code == 404

    # Alice's things are untouched
    assert alice.get(f"/dashboard/templates/{tpl['id']}").status_code == 200
    assert len(alice.get("/dashboard/keys").json()["data"]) == 1


def test_secret_key_cannot_use_other_accounts_template_or_email(client, alice, bob):
    tpl = create_template(alice)
    bob_key = create_secret(bob)["key"]
    r = client.post(
        "/v1/emails",
        headers={"Authorization": f"Bearer {bob_key}"},
        json={"to": "a@example.com", "template_id": tpl["id"], "variables": {}},
    )
    assert r.status_code == 404

    alice_key = create_secret(alice)["key"]
    sent = client.post(
        "/v1/emails", headers={"Authorization": f"Bearer {alice_key}"}, json={"to": "a@example.com", "subject": "s", "text": "t"}
    ).json()
    assert client.get(f"/v1/emails/{sent['id']}", headers={"Authorization": f"Bearer {bob_key}"}).status_code == 404
    assert client.get(f"/v1/emails/{sent['id']}", headers={"Authorization": f"Bearer {alice_key}"}).status_code == 200


# ---------------------------------------------------------------- API keys
def test_secret_key_shown_once_and_stored_hashed(alice):
    created = create_secret(alice)
    assert created["key"].startswith("tu_sk_")
    listed = alice.get("/dashboard/keys").json()["data"][0]
    assert listed["key"] is None  # never shown again
    assert listed["prefix"] == created["key"][:12]

    from app.db import SessionLocal
    from app.models import ApiKey

    with SessionLocal() as db:
        row = db.get(ApiKey, created["id"])
        assert row.public_value is None
        assert created["key"] not in (row.key_hash or "")


def test_revoked_key_stops_working(client, alice):
    key = create_secret(alice)
    alice.delete(f"/dashboard/keys/{key['id']}")
    r = client.post("/v1/emails", headers={"Authorization": f"Bearer {key['key']}"}, json={"to": "a@example.com", "subject": "s", "text": "t"})
    assert r.status_code == 401


def test_bad_or_missing_key(client):
    assert client.post("/v1/emails", json={"to": "a@example.com"}).json()["error"]["code"] == "missing_api_key"
    r = client.post("/v1/emails", headers={"Authorization": "Bearer tu_sk_fake"}, json={"to": "a@example.com"})
    assert r.json()["error"]["code"] == "invalid_api_key"


def test_public_key_cannot_call_server_endpoint(client, alice):
    pk = alice.post("/dashboard/keys", json={"name": "Site", "kind": "public", "allowed_origins": [SITE]}).json()["data"]
    r = client.post("/v1/emails", headers={"Authorization": f"Bearer {pk['key']}"}, json={"to": "a@example.com"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "wrong_key_type"


def test_public_key_requires_allowed_website(alice):
    r = alice.post("/dashboard/keys", json={"name": "Site", "kind": "public", "allowed_origins": []})
    assert r.status_code == 422


# ---------------------------------------------------------------- website forms
def setup_form(alice, **tpl):
    pk = alice.post("/dashboard/keys", json={"name": "Site", "kind": "public", "allowed_origins": ["shop.example.com"]}).json()["data"]
    t = create_template(alice, allow_public=True, **tpl)
    return pk, t


def test_form_from_allowed_website_works(client, alice):
    pk, t = setup_form(alice)
    r = client.post(
        "/v1/forms/send",
        headers={"Origin": SITE},
        data={"public_key": pk["key"], "template_id": t["id"], "name": "Nimal", "email": "nimal@example.com", "message": "Hi!"},
    )
    assert r.status_code == 202, r.text
    assert r.headers["access-control-allow-origin"] == SITE
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert email["status"] == "sent"
    assert email["to"] == ["owner@shop.example.com"]  # fixed recipient, not chosen by the visitor
    assert email["reply_to"] == "nimal@example.com"
    assert email["subject"] == "New message from Nimal"


def test_form_from_other_website_blocked(client, alice):
    pk, t = setup_form(alice)
    r = client.post("/v1/forms/send", headers={"Origin": "https://evil.example"}, data={"public_key": pk["key"], "template_id": t["id"]})
    assert r.status_code == 403 and r.json()["error"]["code"] == "origin_not_allowed"
    r = client.post("/v1/forms/send", data={"public_key": pk["key"], "template_id": t["id"]})  # no Origin at all
    assert r.status_code == 403


def test_form_visitor_cannot_choose_recipient(client, alice):
    pk, t = setup_form(alice)
    r = client.post(
        "/v1/forms/send",
        headers={"Origin": SITE},
        data={"public_key": pk["key"], "template_id": t["id"], "to": "victim@example.org", "message": "spam"},
    )
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert email["to"] == ["owner@shop.example.com"]


def test_form_template_must_be_enabled_for_websites(client, alice):
    pk = alice.post("/dashboard/keys", json={"name": "S", "kind": "public", "allowed_origins": [SITE]}).json()["data"]
    t = create_template(alice, allow_public=False)
    r = client.post("/v1/forms/send", headers={"Origin": SITE}, data={"public_key": pk["key"], "template_id": t["id"]})
    assert r.status_code == 403 and r.json()["error"]["code"] == "template_not_public"


def test_public_key_cannot_use_another_accounts_template(client, alice, bob):
    pk, _ = setup_form(alice)
    bob_t = create_template(bob, allow_public=True)
    r = client.post("/v1/forms/send", headers={"Origin": SITE}, data={"public_key": pk["key"], "template_id": bob_t["id"]})
    assert r.status_code == 404


def test_honeypot_silently_drops_bots(client, alice):
    pk, t = setup_form(alice)
    r = client.post(
        "/v1/forms/send", headers={"Origin": SITE}, data={"public_key": pk["key"], "template_id": t["id"], "_honey": "I am a bot"}
    )
    assert r.status_code == 202
    assert alice.get("/dashboard/emails").json()["total"] == 0


def test_form_rate_limit(client, alice):
    pk, t = setup_form(alice)
    codes = [
        client.post("/v1/forms/send", headers={"Origin": SITE}, data={"public_key": pk["key"], "template_id": t["id"], "message": str(i)}).status_code
        for i in range(12)
    ]
    assert codes[:10] == [202] * 10 and codes[-1] == 429


def test_html_in_form_fields_is_escaped(client, alice):
    pk, t = setup_form(alice)
    r = client.post(
        "/v1/forms/send",
        headers={"Origin": SITE},
        data={"public_key": pk["key"], "template_id": t["id"], "message": "<script>alert(1)</script>"},
    )
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert "<script>" not in email["html"] and "&lt;script&gt;" in email["html"]


def test_subject_header_injection_blocked(client, alice):
    pk, t = setup_form(alice)
    r = client.post(
        "/v1/forms/send",
        headers={"Origin": SITE},
        data={"public_key": pk["key"], "template_id": t["id"], "name": "x\r\nBcc: victim@example.org"},
    )
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert "\n" not in email["subject"] and email["bcc"] == []


def test_dashboard_cors_only_for_console(client, alice):
    r = client.options("/dashboard/keys", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert r.status_code == 403
    r = client.options("/dashboard/keys", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.status_code == 204 and r.headers["access-control-allow-credentials"] == "true"
    r = client.options("/v1/forms/send", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-credentials" not in r.headers
