"""Email through Azure Communication Services: the real Azure SDK talks to a fake Azure endpoint,
so we check the exact request Azure receives (auth, idempotency id, recipients, attachments)."""

import base64
import json

import pytest
import requests
from conftest import make_user

from app.config import Settings, settings
from app.db import SessionLocal
from app.models import EmailMessage
from app.services import providers, queue

KEY = base64.b64encode(b"k" * 32).decode()
CONN = f"endpoint=https://viacodos-email.communication.azure.com/;accesskey={KEY}"


def _response(request, status: int, body: dict, headers: dict | None = None) -> requests.Response:
    import io

    import urllib3

    content = json.dumps(body).encode()
    hdrs = {"Content-Type": "application/json", "Content-Length": str(len(content)), **(headers or {})}
    raw = urllib3.HTTPResponse(body=io.BytesIO(content), headers=hdrs, status=status, preload_content=False)
    resp = requests.Response()
    resp.status_code, resp.raw, resp.request, resp.url = status, raw, request, request.url
    resp.headers = requests.structures.CaseInsensitiveDict(hdrs)
    return resp


class FakeAzure(requests.adapters.BaseAdapter):
    """Plays the Azure Communication Services /emails:send endpoint."""

    def __init__(self):
        super().__init__()
        self.requests: list[dict] = []
        self.fail_with: list[int] = []

    def send(self, request, **kwargs):
        body = json.loads(request.body) if request.body else {}
        self.requests.append({"url": request.url, "headers": dict(request.headers), "body": body})
        if self.fail_with:
            status = self.fail_with.pop(0)
            return _response(request, status, {"error": {"code": "TooManyRequests" if status == 429 else "BadRequest",
                                                         "message": "fake azure error"}})
        op = request.headers.get("Operation-Id", "generated")
        loc = f"https://viacodos-email.communication.azure.com/emails/operations/{op}?api-version=2025-09-01"
        return _response(request, 202, {"id": op, "status": "Running"}, {"Operation-Location": loc})

    def close(self):
        pass


@pytest.fixture
def azure(monkeypatch):
    from azure.core.pipeline.transport import RequestsTransport

    fake = FakeAzure()
    session = requests.Session()
    session.mount("https://", fake)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "acs")
    monkeypatch.setattr(settings, "ACS_CONNECTION_STRING", CONN)
    monkeypatch.setattr(settings, "ACS_EVENTS_TOKEN", "acs-events-token-" + "z" * 20)
    providers.reset_acs_client(transport=RequestsTransport(session=session))
    yield fake
    providers.reset_acs_client()


def secret(c):
    return c.post("/dashboard/keys", json={"name": "S", "kind": "secret"}).json()["data"]["key"]


def deliver_all():
    with SessionLocal() as db:
        for m in db.query(EmailMessage).filter(EmailMessage.status == "queued").all():
            m.next_attempt_at = None
        db.commit()
    queue.process_due()


def test_email_reaches_azure_with_everything(client, alice, azure):
    key = secret(alice)
    data = {"to": ["ann@example.com", "bob@example.com"], "cc": "boss@example.com", "bcc": "audit@example.com",
            "reply_to": "alice@example.com", "subject": "Hello from Azure", "html": "<b>Hi</b>", "text": "Hi",
            "attachments": [{"filename": "price list.pdf", "content": base64.b64encode(b"%PDF-1.4 hello").decode(),
                             "content_type": "application/pdf"}]}
    r = client.post("/v1/emails", headers={"Authorization": f"Bearer {key}"}, json=data)
    assert r.status_code == 202, r.text
    msg_id = r.json()["id"]
    deliver_all()
    assert len(azure.requests) == 1
    req = azure.requests[0]
    assert "/emails:send" in req["url"]
    assert req["headers"]["Authorization"].startswith("HMAC-SHA256")  # signed with the access key, never sent in plain
    assert KEY not in json.dumps(req["headers"])
    assert req["headers"]["Operation-Id"] == providers.acs_operation_id(msg_id)
    b = req["body"]
    assert b["senderAddress"] == settings.DEFAULT_FROM_EMAIL
    assert [x["address"] for x in b["recipients"]["to"]] == ["ann@example.com", "bob@example.com"]
    assert [x["address"] for x in b["recipients"]["cc"]] == ["boss@example.com"]
    assert [x["address"] for x in b["recipients"]["bcc"]] == ["audit@example.com"]
    assert b["replyTo"] == [{"address": "alice@example.com"}]
    assert b["content"]["subject"] == "Hello from Azure" and "<b>Hi</b>" in b["content"]["html"]
    assert b["content"]["plainText"].strip() == "Hi"
    att = b["attachments"][0]
    assert att["name"] == "price list.pdf" and base64.b64decode(att["contentInBase64"]) == b"%PDF-1.4 hello"
    assert b["headers"]["X-ThumbsUp-Message-Id"] == msg_id
    assert b["userEngagementTrackingDisabled"] is True
    with SessionLocal() as db:
        m = db.get(EmailMessage, msg_id)
        assert m.status == "sent" and m.provider_message_id == providers.acs_operation_id(msg_id)


def test_azure_busy_is_retried_with_the_same_id(client, alice, azure):
    key = secret(alice)
    azure.fail_with = [429]
    msg_id = client.post("/v1/emails", headers={"Authorization": f"Bearer {key}"},
                         json={"to": "a@example.com", "subject": "s", "text": "t"}).json()["id"]
    with SessionLocal() as db:  # first try hit Azure's limit: waiting for a retry, not lost
        m = db.get(EmailMessage, msg_id)
        assert m.status == "queued" and m.attempts == 1 and "sending limit" in (m.error or "")
    deliver_all()
    ops = {r["headers"]["Operation-Id"] for r in azure.requests}
    assert len(azure.requests) == 2 and len(ops) == 1  # every try used the same id: Azure can never send it twice
    with SessionLocal() as db:
        assert db.get(EmailMessage, msg_id).status == "sent"


def test_azure_rejection_fails_without_retry(client, alice, azure):
    key = secret(alice)
    azure.fail_with = [400]
    msg_id = client.post("/v1/emails", headers={"Authorization": f"Bearer {key}"},
                         json={"to": "a@example.com", "subject": "s", "text": "t"}).json()["id"]
    deliver_all()
    with SessionLocal() as db:
        assert db.get(EmailMessage, msg_id).status == "failed"


def test_event_grid_reports(client, alice, azure):
    key = secret(alice)
    url = f"/v1/providers/acs/events/{settings.ACS_EVENTS_TOKEN}"
    # Event Grid's one-time validation handshake
    r = client.post(url, json=[{"eventType": "Microsoft.EventGrid.SubscriptionValidationEvent", "data": {"validationCode": "abc-123"}}])
    assert r.json() == {"validationResponse": "abc-123"}
    assert client.post("/v1/providers/acs/events/wrong-token", json=[]).status_code == 404
    assert client.options(url, headers={"WebHook-Request-Origin": "eventgrid.azure.net"}).headers["webhook-allowed-origin"] == "eventgrid.azure.net"

    def sent(to):
        mid = client.post("/v1/emails", headers={"Authorization": f"Bearer {key}"},
                          json={"to": to, "subject": "s", "text": "t"}).json()["id"]
        deliver_all()
        return mid

    def report(mid, status, recipient, cloud=False):
        data = {"sender": "DoNotReply@viacodos.com", "recipient": recipient, "messageId": providers.acs_operation_id(mid),
                "status": status, "deliveryStatusDetails": {"statusMessage": "550 5.1.1 no such user"}}
        ev = {"type" if cloud else "eventType": "Microsoft.Communication.EmailDeliveryReportReceived", "data": data}
        assert client.post(url, json=ev if cloud else [ev]).status_code == 200

    a, b, c, d = sent("ok@example.com"), sent("gone@example.com"), sent("spam@example.com"), sent("cloud@example.com")
    report(a, "Delivered", "ok@example.com")
    report(b, "Bounced", "gone@example.com")
    report(c, "FilteredSpam", "spam@example.com")
    report(d, "Delivered", "cloud@example.com", cloud=True)  # CloudEvents schema works too
    report("em_not_ours", "Bounced", "x@example.com")  # ignored
    status = {m: alice.get(f"/dashboard/emails/{m}").json()["data"]["status"] for m in (a, b, c, d)}
    assert status == {a: "delivered", b: "bounced", c: "failed", d: "delivered"}
    assert [s["email"] for s in alice.get("/dashboard/suppressions").json()["data"]] == ["gone@example.com"]
    # the bounced address is now skipped automatically
    again = client.post("/v1/emails", headers={"Authorization": f"Bearer {key}"},
                        json={"to": "gone@example.com", "subject": "s", "text": "t"}).json()["id"]
    before = len(azure.requests)
    deliver_all()
    assert len(azure.requests) == before
    assert alice.get(f"/dashboard/emails/{again}").json()["data"]["status"] == "failed"


def test_other_accounts_reports_cannot_be_forged_without_token(client, alice, azure):
    bob = make_user(client, "bob2@example.com")
    assert client.post("/v1/providers/acs/events/" + "x" * 40, json=[]).status_code == 404
    assert bob.get("/dashboard/suppressions").json()["total"] == 0


@pytest.mark.parametrize("change, text", [
    ({"ACS_CONNECTION_STRING": "", "ACS_ENDPOINT": ""}, "ACS_ENDPOINT"),
    ({"ACS_EVENTS_TOKEN": ""}, "ACS_EVENTS_TOKEN"),
])
def test_azure_email_config_is_checked(change, text):
    from app.config import ConfigError

    base = dict(ENVIRONMENT="production", EMAIL_PROVIDER="acs", ACS_ENDPOINT="https://x.communication.azure.com",
                ACS_EVENTS_TOKEN="t" * 30, DEFAULT_FROM_EMAIL="DoNotReply@viacodos.com", JWT_SECRET="x" * 48, COOKIE_SECURE=True,
                PUBLIC_BASE_URL="https://api.viacodos.com", DATABASE_URL="postgresql+psycopg://u:p@db/t",
                DASHBOARD_ORIGINS="https://console.viacodos.com", DASHBOARD_URL="https://console.viacodos.com/console",
                GOOGLE_OAUTH_CLIENT_ID="", GOOGLE_OAUTH_CLIENT_SECRET="")
    Settings(_env_file=None, **base).validate_for_startup()  # complete settings start fine
    with pytest.raises(ConfigError, match=text):
        Settings(_env_file=None, **{**base, **change}).validate_for_startup()
