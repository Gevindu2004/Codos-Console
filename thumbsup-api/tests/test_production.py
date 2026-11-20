"""Production behaviour: config safety, verification, queue retries, bounces, domains."""

import re
from datetime import datetime, timedelta, timezone

import pytest
from conftest import make_user

from app.config import ConfigError, Settings
from app.db import SessionLocal
from app.models import EmailMessage, Suppression
from app.services import providers, queue


def secret(c):
    return c.post("/dashboard/keys", json={"name": "S", "kind": "secret"}).json()["data"]["key"]


def send(client, key, **body):
    payload = {"to": "a@example.com", "subject": "s", "text": "t", **body}
    return client.post("/v1/emails", headers={"Authorization": f"Bearer {key}"}, json=payload)


def outbox_codes(capsys=None):
    import glob
    import os

    codes = []
    for path in sorted(glob.glob(os.path.join(os.environ["STORAGE_DIR"], "outbox", "sys_*.eml")), key=os.path.getmtime):
        codes += re.findall(r"Subject: (\d{6}) is your", open(path, encoding="utf-8").read())
    return codes


# ---------------------------------------------------------------- config
def good(**kw):
    base = dict(
        ENVIRONMENT="production",
        EMAIL_PROVIDER="smtp",
        SMTP_HOST="smtp.example.com",
        SMTP_USERNAME="u",
        SMTP_PASSWORD="p",
        DEFAULT_FROM_EMAIL="hello@example.com",
        JWT_SECRET="x" * 48,
        COOKIE_SECURE=True,
        PUBLIC_BASE_URL="https://api.example.com",
        DATABASE_URL="postgresql+psycopg://u:p@db/thumbsup",
        DASHBOARD_ORIGINS="https://console.example.com",
        DASHBOARD_URL="https://console.example.com/thumbsup",
        GOOGLE_OAUTH_CLIENT_ID="cid",
        GOOGLE_OAUTH_CLIENT_SECRET="csecret",
        DATA_ENCRYPTION_KEY="k" * 48,
    )
    base.update(kw)
    return Settings(_env_file=None, **base)


def test_valid_production_config_starts():
    good().validate_for_startup()


@pytest.mark.parametrize(
    "change, text",
    [
        ({"EMAIL_PROVIDER": ""}, "EMAIL_PROVIDER is not set"),
        ({"EMAIL_PROVIDER": "log"}, "only for automated tests"),
        ({"SMTP_PASSWORD": ""}, "SMTP_PASSWORD is empty"),
        ({"JWT_SECRET": "short"}, "JWT_SECRET"),
        ({"COOKIE_SECURE": False}, "COOKIE_SECURE"),
        ({"PUBLIC_BASE_URL": "http://api.example.com"}, "PUBLIC_BASE_URL"),
        ({"DATABASE_URL": "sqlite:///x.db"}, "PostgreSQL"),
        ({"DASHBOARD_ORIGINS": "http://console.example.com"}, "DASHBOARD_ORIGINS"),
        ({"DEFAULT_FROM_EMAIL": ""}, "DEFAULT_FROM_EMAIL"),
        ({"ASSET_STORAGE": "azure"}, "AZURE_STORAGE_ACCOUNT_URL"),
        ({"ASSET_STORAGE": "ftp"}, "local, s3 or azure"),
        ({"GOOGLE_OAUTH_CLIENT_SECRET": ""}, "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET"),
        ({"DATA_ENCRYPTION_KEY": "short"}, "DATA_ENCRYPTION_KEY must be a random string"),
        ({"DATA_ENCRYPTION_KEY": "x" * 48}, "different from JWT_SECRET"),
        ({"DASHBOARD_URL": "http://console.example.com"}, "DASHBOARD_URL"),
        ({"GOOGLE_OAUTH_REDIRECT_URL": "http://api.example.com/cb"}, "GOOGLE_OAUTH_REDIRECT_URL"),
    ],
)
def test_unsafe_config_refuses_to_start(change, text):
    with pytest.raises(ConfigError, match=text):
        good(**change).validate_for_startup()


def test_development_requires_real_provider_too():
    s = Settings(_env_file=None, ENVIRONMENT="development", EMAIL_PROVIDER="", JWT_SECRET="x" * 48)
    with pytest.raises(ConfigError, match="EMAIL_PROVIDER"):
        s.validate_for_startup()


# ---------------------------------------------------------------- account verification
def test_unverified_account_can_only_email_itself(client):
    c = make_user(client, "new@example.com", verified=False)
    key = secret(c)
    r = send(client, key, to="stranger@example.com")
    assert r.status_code == 403 and r.json()["error"]["code"] == "account_not_verified"
    assert send(client, key, to="new@example.com").status_code == 202


def test_verify_with_emailed_code(client):
    c = make_user(client, "v@example.com", verified=False)
    assert c.get("/dashboard/auth/me").json()["user"]["email_verified"] is False
    assert c.post("/dashboard/auth/verify", json={"code": "000000"}).status_code == 400
    code = outbox_codes()[-1]
    r = c.post("/dashboard/auth/verify", json={"code": code})
    assert r.status_code == 200 and r.json()["user"]["email_verified"] is True
    assert send(client, secret(c), to="stranger@example.com").status_code == 202


def test_password_reset_with_code(client):
    make_user(client, "r@example.com", password="oldpass123")
    r = client.post("/dashboard/auth/password/forgot", json={"email": "r@example.com"})
    same = client.post("/dashboard/auth/password/forgot", json={"email": "nobody@example.com"})
    assert r.json() == same.json()  # doesn't reveal which emails exist
    code = outbox_codes()[-1]
    bad = client.post("/dashboard/auth/password/reset", json={"email": "r@example.com", "code": "123456", "password": "newpass123"})
    assert bad.status_code == 400
    ok = client.post("/dashboard/auth/password/reset", json={"email": "r@example.com", "code": code, "password": "newpass123"})
    assert ok.status_code == 200
    assert client.post("/dashboard/auth/login", json={"email": "r@example.com", "password": "newpass123"}).status_code == 200
    # the code can't be reused
    again = client.post("/dashboard/auth/password/reset", json={"email": "r@example.com", "code": code, "password": "other12345"})
    assert again.status_code == 400


def test_code_locks_after_too_many_guesses(client):
    c = make_user(client, "g@example.com", verified=False)
    code = outbox_codes()[-1]
    for _ in range(5):
        c.post("/dashboard/auth/verify", json={"code": "999999" if code != "999999" else "888888"})
    assert c.post("/dashboard/auth/verify", json={"code": code}).status_code == 400


# ---------------------------------------------------------------- queue & retries
def test_attachments_survive_until_delivery(client, alice, monkeypatch):
    """Delivery happens later (worker); the file must still be there."""
    import base64

    captured = {}

    def fake_send(mime, to):
        captured["raw"] = mime.as_bytes().decode()
        return "id-1"

    monkeypatch.setattr(providers, "send", fake_send)
    r = send(client, secret(alice), attachments=[{"filename": "a.txt", "content": base64.b64encode(b"hello").decode()}])
    assert 'filename="a.txt"' in captured["raw"]
    email = alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]
    assert email["status"] == "sent" and email["attempts"] == 1


def test_temporary_failure_is_retried_then_sent(client, alice, monkeypatch):
    calls = {"n": 0}

    def flaky(mime, to):
        calls["n"] += 1
        if calls["n"] == 1:
            raise providers.ProviderError("Could not reach the mail server", temporary=True)
        return "ok-id"

    monkeypatch.setattr(providers, "send", flaky)
    r = send(client, secret(alice))
    mid = r.json()["id"]
    email = alice.get(f"/dashboard/emails/{mid}").json()["data"]
    assert email["status"] == "queued" and "next try" in email["error"]

    # pretend the retry time has come
    with SessionLocal() as db:
        db.get(EmailMessage, mid).next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    queue.process_due()
    email = alice.get(f"/dashboard/emails/{mid}").json()["data"]
    assert email["status"] == "sent" and email["attempts"] == 2 and email["error"] is None


def test_gives_up_after_max_attempts(client, alice, monkeypatch):
    monkeypatch.setattr(providers, "send", lambda m, t: (_ for _ in ()).throw(providers.ProviderError("down", temporary=True)))
    mid = send(client, secret(alice)).json()["id"]
    for _ in range(10):
        with SessionLocal() as db:
            m = db.get(EmailMessage, mid)
            if m.status != "queued":
                break
            m.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.commit()
        queue.process_due()
    email = alice.get(f"/dashboard/emails/{mid}").json()["data"]
    assert email["status"] == "failed" and email["attempts"] == 6


def test_stuck_sending_is_recovered(client, alice, monkeypatch):
    monkeypatch.setattr(providers, "send", lambda m, t: "x")
    mid = send(client, secret(alice)).json()["id"]
    with SessionLocal() as db:
        m = db.get(EmailMessage, mid)
        m.status, m.next_attempt_at = "sending", datetime.now(timezone.utc) - timedelta(minutes=30)
        db.commit()
    queue.process_due()
    assert alice.get(f"/dashboard/emails/{mid}").json()["data"]["status"] == "sent"


# ---------------------------------------------------------------- bounces & suppression
def test_hard_bounce_is_suppressed_and_skipped_next_time(client, alice, monkeypatch):
    def refuse(mime, to):
        raise providers.ProviderError("refused", bounced={"ghost@example.com": "550 No such user"})

    monkeypatch.setattr(providers, "send", refuse)
    key = secret(alice)
    first = send(client, key, to="ghost@example.com").json()["id"]
    assert alice.get(f"/dashboard/emails/{first}").json()["data"]["status"] == "failed"
    sup = alice.get("/dashboard/suppressions").json()["data"]
    assert sup[0]["email"] == "ghost@example.com" and sup[0]["reason"] == "bounce"

    monkeypatch.setattr(providers, "send", lambda m, t: "ok")
    second = send(client, key, to=["ghost@example.com", "real@example.com"]).json()["id"]
    email = alice.get(f"/dashboard/emails/{second}").json()["data"]
    assert email["status"] == "sent" and email["suppressed"] == ["ghost@example.com"]

    # removing it from the list allows sending again
    alice.delete(f"/dashboard/suppressions/{sup[0]['id']}")
    assert alice.get("/dashboard/suppressions").json()["total"] == 0


def test_suppression_list_is_private(client, alice, bob):
    alice.post("/dashboard/suppressions", json={"email": "x@example.com"})
    sid = alice.get("/dashboard/suppressions").json()["data"][0]["id"]
    assert bob.get("/dashboard/suppressions").json()["total"] == 0
    assert bob.delete(f"/dashboard/suppressions/{sid}").status_code == 404


def test_ses_bounce_and_delivery_events(client, alice, monkeypatch):
    import json

    from app.config import settings

    monkeypatch.setattr(settings, "SES_EVENTS_TOKEN", "tok123")
    monkeypatch.setattr(providers, "send", lambda m, t: "ses-msg-1")
    key = secret(alice)
    a = send(client, key, to="good@example.com").json()["id"]

    def post(event):
        return client.post("/v1/providers/ses/events/tok123", content=json.dumps({"Type": "Notification", "Message": json.dumps(event)}))

    assert client.post("/v1/providers/ses/events/wrong", content="{}").status_code == 404
    post({"eventType": "Delivery", "mail": {"messageId": "ses-msg-1"}})
    assert alice.get(f"/dashboard/emails/{a}").json()["data"]["status"] == "delivered"

    monkeypatch.setattr(providers, "send", lambda m, t: "ses-msg-2")
    b = send(client, key, to="gone@example.com").json()["id"]
    post({"eventType": "Bounce", "mail": {"messageId": "ses-msg-2"},
          "bounce": {"bounceType": "Permanent", "bouncedRecipients": [{"emailAddress": "gone@example.com", "diagnosticCode": "550 5.1.1"}]}})
    assert alice.get(f"/dashboard/emails/{b}").json()["data"]["status"] == "bounced"
    assert alice.get("/dashboard/suppressions").json()["data"][0]["email"] == "gone@example.com"


# ---------------------------------------------------------------- custom domains
class FakeSES:
    verified = False

    def create_email_identity(self, EmailIdentity):
        return {"DkimAttributes": {"Tokens": ["t1", "t2", "t3"]}}

    def get_email_identity(self, EmailIdentity):
        return {"VerifiedForSendingStatus": self.verified, "DkimAttributes": {"Status": "SUCCESS" if self.verified else "PENDING"}}

    def delete_email_identity(self, EmailIdentity):
        return {}


def test_custom_domain_flow(client, alice, bob, monkeypatch):
    fake = FakeSES()
    monkeypatch.setattr(providers, "ses_client", lambda: fake)
    key = secret(alice)

    # can't send from an unverified domain (no spoofing)
    r = send(client, key, **{"from": "hello@acme-shop.com"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "domain_not_verified"

    d = alice.post("/dashboard/domains", json={"name": "https://www.Acme-Shop.com/"}).json()["data"]
    assert d["name"] == "acme-shop.com" and d["status"] == "pending"
    assert [x["type"] for x in d["records"]][:3] == ["CNAME"] * 3
    assert alice.post(f"/dashboard/domains/{d['id']}/check").json()["data"]["status"] == "pending"

    # another account can't claim it, see it, or use it
    assert bob.post("/dashboard/domains", json={"name": "acme-shop.com"}).status_code == 409
    assert bob.post(f"/dashboard/domains/{d['id']}/check").status_code == 404

    fake.verified = True
    assert alice.post(f"/dashboard/domains/{d['id']}/check").json()["data"]["status"] == "verified"
    monkeypatch.setattr(providers, "send", lambda m, t: "ok")
    r = send(client, key, **{"from": "hello@acme-shop.com"})
    assert r.status_code == 202
    assert alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]["from"].endswith("<hello@acme-shop.com>")

    r = send(client, key, **{"from": "Acme Shop <sales@acme-shop.com>"})
    assert alice.get(f"/dashboard/emails/{r.json()['id']}").json()["data"]["from"] == "Acme Shop <sales@acme-shop.com>"

    bob_key = secret(bob)
    assert send(client, bob_key, **{"from": "ceo@acme-shop.com"}).status_code == 422


def test_public_email_domains_rejected(alice, monkeypatch):
    monkeypatch.setattr(providers, "ses_client", lambda: FakeSES())
    assert alice.post("/dashboard/domains", json={"name": "gmail.com"}).status_code == 422


def test_smtp_wrong_password_fails_clearly_without_retry(monkeypatch):
    import smtplib

    from app.config import settings
    from app.services.files import Attachment  # noqa: F401

    class FakeSMTP:
        def __init__(self, *a, **k):
            pass

        def starttls(self, context=None):
            pass

        def login(self, u, p):
            raise smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    for k, v in dict(SMTP_HOST="smtp.gmail.com", SMTP_USERNAME="me@gmail.com", SMTP_PASSWORD="bad").items():
        monkeypatch.setattr(settings, k, v)
    mime = providers.build_mime(from_email="me@gmail.com", from_name="", to=["a@example.com"], cc=[], reply_to=None,
                                subject="s", html="", text="t", attachments=[], message_id="em_x")
    with pytest.raises(providers.ProviderError) as err:
        providers._send_smtp(mime, ["a@example.com"])
    assert err.value.temporary is False and "App Password" in str(err.value)
