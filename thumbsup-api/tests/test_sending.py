"""Sending features: API, templates, files, idempotency, auto-reply, webhooks."""

import base64
import os

from conftest import SITE


def key(c):
    return c.post("/dashboard/keys", json={"name": "Server", "kind": "secret"}).json()["data"]["key"]


def auth(k):
    return {"Authorization": f"Bearer {k}"}


def outbox_file(email_id):
    return os.path.join(os.environ["STORAGE_DIR"], "outbox", f"{email_id}.eml")


def test_send_raw_email(client, alice):
    k = key(alice)
    r = client.post(
        "/v1/emails",
        headers=auth(k),
        json={"to": ["a@example.com", "A@example.com"], "cc": "c@example.com", "subject": "Hello", "html": "<h1>Hi</h1>"},
    )
    assert r.status_code == 202, r.text
    status = client.get(f"/v1/emails/{r.json()['id']}", headers=auth(k)).json()
    assert status["status"] == "sent"
    assert status["to"] == ["a@example.com"]  # duplicates removed
    raw = open(outbox_file(r.json()["id"]), "rb").read().decode()
    assert "Subject: Hello" in raw and "<h1>Hi</h1>" in raw


def test_send_with_template_and_variables(client, alice):
    t = alice.post(
        "/dashboard/templates",
        json={"name": "Welcome", "subject": "Welcome {{name}}!", "html": "<p>Your code: {{code}}</p>"},
    ).json()["data"]
    assert t["variables"] == ["name", "code"]
    r = client.post(
        "/v1/emails", headers=auth(key(alice)), json={"to": "u@example.com", "template_id": t["id"], "variables": {"name": "Oshan", "code": "123"}}
    )
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert email["subject"] == "Welcome Oshan!" and "Your code: 123" in email["html"]
    assert "Your code: 123" in email["text"]  # plain-text version generated automatically


def test_validation_errors_are_friendly(client, alice):
    k = key(alice)
    r = client.post("/v1/emails", headers=auth(k), json={"to": "not-an-email", "subject": "s", "text": "t"})
    assert r.status_code == 422 and "not a valid email" in r.json()["error"]["message"]
    r = client.post("/v1/emails", headers=auth(k), json={"to": "a@example.com", "text": "t"})
    assert r.json()["error"]["code"] == "missing_subject"
    r = client.post("/v1/emails", headers=auth(k), json={"to": "a@example.com", "subject": "s"})
    assert r.json()["error"]["code"] == "missing_content"


def test_attachments(client, alice):
    data = base64.b64encode(b"%PDF-1.4 tiny pdf").decode()
    r = client.post(
        "/v1/emails",
        headers=auth(key(alice)),
        json={"to": "a@example.com", "subject": "Invoice", "text": "Attached", "attachments": [{"filename": "invoice.pdf", "content": data}]},
    )
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert email["attachments"][0]["delivery"] == "attached"
    assert 'filename="invoice.pdf"' in open(outbox_file(r.json()["id"]), "rb").read().decode()


def test_dangerous_files_blocked(client, alice):
    data = base64.b64encode(b"MZ...").decode()
    r = client.post(
        "/v1/emails",
        headers=auth(key(alice)),
        json={"to": "a@example.com", "subject": "x", "text": "x", "attachments": [{"filename": "free-money.exe", "content": data}]},
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "file_type_blocked"


def test_large_file_becomes_secure_download_link(client, alice):
    big = os.urandom(1_200_000)  # tests set the inline limit to 1 MB
    r = client.post(
        "/v1/emails",
        headers=auth(key(alice)),
        json={"to": "a@example.com", "subject": "Big", "text": "See file", "attachments": [{"filename": "photos.zip", "content": base64.b64encode(big).decode()}]},
    )
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    att = email["attachments"][0]
    assert att["delivery"] == "link"
    link = [line for line in email["text"].splitlines() if "/v1/files/" in line][0]
    token = link.rsplit("/v1/files/", 1)[1]
    dl = client.get(f"/v1/files/{token}")
    assert dl.status_code == 200 and dl.content == big
    assert "attachment" in dl.headers["content-disposition"]
    assert client.get("/v1/files/not-a-real-token").status_code == 404


def test_idempotency_key_prevents_double_send(client, alice):
    k = key(alice)
    body = {"to": "a@example.com", "subject": "Pay", "text": "Receipt"}
    a = client.post("/v1/emails", headers={**auth(k), "Idempotency-Key": "order-42"}, json=body)
    b = client.post("/v1/emails", headers={**auth(k), "Idempotency-Key": "order-42"}, json=body)
    assert a.json()["id"] == b.json()["id"] and b.json()["duplicate"] is True
    assert alice.get("/dashboard/emails").json()["total"] == 1


def test_form_with_file_upload_and_auto_reply(client, alice):
    pk = alice.post("/dashboard/keys", json={"name": "Site", "kind": "public", "allowed_origins": [SITE]}).json()["data"]
    t = alice.post(
        "/dashboard/templates",
        json={
            "name": "Careers",
            "subject": "Application: {{name}}",
            "text": "{{name}} applied",
            "to_emails": ["hr@shop.example.com"],
            "allow_public": True,
            "auto_reply": True,
            "auto_reply_subject": "Thanks {{name}}",
            "auto_reply_text": "We got your CV, {{name}}.",
        },
    ).json()["data"]
    r = client.post(
        "/v1/forms/send",
        headers={"Origin": SITE},
        data={"public_key": pk["key"], "template_id": t["id"], "name": "Kamal", "email": "kamal@example.com"},
        files={"cv": ("My CV.pdf", b"%PDF cv", "application/pdf")},
    )
    assert r.status_code == 202, r.text
    emails = alice.get("/dashboard/emails").json()["data"]
    assert {e["source"] for e in emails} == {"form", "auto_reply"}
    form = next(e for e in emails if e["source"] == "form")
    reply = next(e for e in emails if e["source"] == "auto_reply")
    assert form["attachments"][0]["filename"] == "My CV.pdf"
    assert reply["to"] == ["kamal@example.com"] and reply["subject"] == "Thanks Kamal"


def test_form_without_body_lists_fields(client, alice):
    pk = alice.post("/dashboard/keys", json={"name": "Site", "kind": "public", "allowed_origins": [SITE]}).json()["data"]
    t = alice.post(
        "/dashboard/templates",
        json={"name": "Raw", "subject": "Form", "text": "", "to_emails": ["o@shop.example.com"], "allow_public": True},
    ).json()["data"]
    r = client.post("/v1/forms/send", headers={"Origin": SITE}, json={"public_key": pk["key"], "template_id": t["id"], "phone": "0771234567"})
    assert r.status_code == 202, r.text
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert "0771234567" in email["html"] and "phone: 0771234567" in email["text"]


def test_failed_delivery_is_reported(client, alice, monkeypatch):
    from app.services import providers

    def boom(*_a, **_k):
        raise providers.ProviderError("SMTP server error: mailbox unavailable")

    monkeypatch.setattr(providers, "send", boom)
    r = client.post("/v1/emails", headers=auth(key(alice)), json={"to": "a@example.com", "subject": "s", "text": "t"})
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert email["status"] == "failed" and "mailbox unavailable" in email["error"]


def test_webhook_signed_delivery(client, alice, monkeypatch):
    import hashlib
    import hmac

    import httpx

    captured = {}

    class FakeResp:
        status_code = 200
        text = "ok"

    def fake_post(url, content, headers, **kw):
        captured.update(url=url, body=content, headers=headers)
        return FakeResp()

    monkeypatch.setattr(httpx, "post", fake_post)
    wh = alice.post("/dashboard/webhooks", json={"url": "https://hooks.example.com/tu", "events": ["email.sent"]}).json()["data"]
    client.post("/v1/emails", headers=auth(key(alice)), json={"to": "a@example.com", "subject": "s", "text": "t"})
    ts = captured["headers"]["ThumbsUp-Timestamp"]
    expected = hmac.new(wh["secret"].encode(), ts.encode() + b"." + captured["body"], hashlib.sha256).hexdigest()
    assert captured["headers"]["ThumbsUp-Signature"] == f"v1={expected}"
    deliveries = alice.get(f"/dashboard/webhooks/{wh['id']}/deliveries").json()["data"]
    assert deliveries[0]["success"] is True


def test_stats(client, alice):
    k = key(alice)
    for _ in range(3):
        client.post("/v1/emails", headers=auth(k), json={"to": "a@example.com", "subject": "s", "text": "t"})
    s = alice.get("/dashboard/stats").json()
    assert s["last_30_days"]["sent"] == 3 and s["today"] == 3 and len(s["daily"]) == 14
