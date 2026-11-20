import os
import shutil
import tempfile

_TMP = tempfile.mkdtemp(prefix="thumbsup-test-")
os.environ["STORAGE_DIR"] = _TMP
# TEST_DATABASE_URL=postgresql+psycopg://... runs every test against PostgreSQL (like production on Azure)
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{_TMP}/test.db"
os.environ["ENVIRONMENT"] = "test"
os.environ["EMAIL_PROVIDER"] = "log"  # automated tests only: writes .eml files instead of sending
os.environ["DEFAULT_FROM_EMAIL"] = "no-reply@thumbsup.test"
os.environ["WORKER_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
os.environ["MAX_INLINE_ATTACHMENTS_MB"] = "1"
os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"] = (
    '{"type": "service_account", "client_email": "robot@thumbsup-test.iam.gserviceaccount.com", "private_key": "test"}'
)
os.environ["ASSET_DELETE_GRACE_MINUTES"] = "30"
os.environ["GOOGLE_OAUTH_CLIENT_ID"] = "test-client-id"
os.environ["GOOGLE_OAUTH_CLIENT_SECRET"] = "test-client-secret"
os.environ["DATA_ENCRYPTION_KEY"] = "test-encryption-key-" + "y" * 40
os.environ["DASHBOARD_URL"] = "http://console.test/dashboard"
os.environ["SHEETS_WRITES_PER_MINUTE"] = "100000"
os.environ["SHEETS_READS_PER_MINUTE"] = "100000"
os.environ["SHEETS_CACHE_SECONDS"] = "0"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.security import rate_limiter  # noqa: E402

SITE = "https://shop.example.com"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    rate_limiter.reset()
    yield


@pytest.fixture
def google(monkeypatch):
    """A fake Google (sign-in + Sheets API) wired into the Sheets client."""
    from app.services import sheets_google
    from fake_sheets import FakeGoogle

    fake = FakeGoogle()
    sheets_google.set_transport(fake.transport())
    sheets_google._robot_tokens["static"] = "robot-token"
    sheets_google.budget.reset()
    monkeypatch.setattr(sheets_google, "_sleep", lambda s: None)
    yield fake
    sheets_google.set_transport(None)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def make_user(client: TestClient, email: str, password: str = "secret123", verified: bool = True) -> TestClient:
    """Return a NEW client logged in as this user (each client keeps its own cookie)."""
    c = TestClient(app)
    r = c.post("/dashboard/auth/register", json={"name": email.split("@")[0], "email": email, "password": password})
    assert r.status_code == 201, r.text
    if verified:
        from app.db import SessionLocal
        from app.models import User

        with SessionLocal() as db:
            db.get(User, r.json()["user"]["id"]).email_verified = True
            db.commit()
    return c


@pytest.fixture
def alice(client):
    return make_user(client, "alice@example.com")


@pytest.fixture
def bob(client):
    return make_user(client, "bob@example.com")


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP, ignore_errors=True)
