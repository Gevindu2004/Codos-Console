"""Serving from Azure Blob Storage, against Azurite (Microsoft's official local Azure Storage emulator).

Skipped automatically when Azurite isn't installed (npm i -g azurite)."""

import shutil
import socket
import subprocess
import tempfile
import time

import pytest
from fake_drive import FakeDrive

from app.config import settings
from app.services import asset_sync, drive
from app.services.asset_storage import reset_storage

AZURITE_CONN = (
    "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;"
    "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;"
    "BlobEndpoint=http://127.0.0.1:{port}/devstoreaccount1;"
)


@pytest.fixture(scope="module")
def azurite():
    exe = shutil.which("azurite-blob")
    if not exe:
        pytest.skip("Azurite not installed")
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    folder = tempfile.mkdtemp(prefix="azurite-")
    proc = subprocess.Popen([exe, "--blobHost", "127.0.0.1", "--blobPort", str(port), "--location", folder, "--silent",
                             "--skipApiVersionCheck"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    yield AZURITE_CONN.format(port=port)
    proc.terminate()
    shutil.rmtree(folder, ignore_errors=True)


@pytest.fixture
def blob(azurite, monkeypatch):
    from azure.storage.blob import BlobServiceClient

    svc = BlobServiceClient.from_connection_string(azurite)
    try:
        svc.create_container("tu-assets")
    except Exception:  # noqa: BLE001 - already there from another test
        pass
    for k, v in dict(ASSET_STORAGE="azure", AZURE_STORAGE_CONNECTION_STRING=azurite, AZURE_STORAGE_CONTAINER="tu-assets").items():
        monkeypatch.setattr(settings, k, v)
    reset_storage()
    yield svc.get_container_client("tu-assets")
    reset_storage()


def test_azure_blob_storage_end_to_end(client, alice, blob):
    fake = FakeDrive()
    drive.set_client(fake)
    try:
        folder = fake.folder("Site", share=True)
        video = bytes(range(256)) * 400
        fake.upload(folder, "intro.mp4", video, "video/mp4")
        fid = fake.upload(folder, "hero.png", b"OLD")
        fake.upload(folder, alice.get("/dashboard/assets/config").json()["verification_file"], b"", "text/plain")
        p = alice.post("/dashboard/assets/projects", json={"folder_link": folder}).json()["data"]
        assert client.get("/a/site/hero.png").content == b"OLD"
        r = client.get("/a/site/intro.mp4", headers={"Range": "bytes=1000-1999"})
        assert r.status_code == 206 and r.content == video[1000:2000]
        assert r.headers["content-range"] == f"bytes 1000-1999/{len(video)}"
        r = client.get("/a/site/intro.mp4", headers={"Range": "bytes=-100"})
        assert r.status_code == 206 and r.content == video[-100:]
        full = client.get("/a/site/intro.mp4")
        assert full.status_code == 200 and full.content == video
        assert client.head("/a/site/intro.mp4").headers["content-length"] == str(len(video))

        fake.new_version(fid, b"NEW")
        asset_sync.request_sync(p["id"])
        asset_sync.sync_project(p["id"])
        assert client.get("/a/site/hero.png").content == b"NEW"
        assert len(list(blob.list_blobs())) == 2  # the old copy was deleted
        alice.delete(f"/dashboard/assets/projects/{p['id']}")
        assert list(blob.list_blobs()) == []
    finally:
        drive.set_client(None)


def test_email_files_live_in_azure_blob(client, alice, blob, monkeypatch):
    """Attachments waiting to be sent and big files sent as links must survive restarts and work on any server copy."""
    import base64
    import os

    from app.db import SessionLocal
    from app.models import EmailMessage
    from app.services import providers, queue

    key = alice.post("/dashboard/keys", json={"name": "k", "kind": "secret"}).json()["data"]["key"]
    big = os.urandom(1_300_000)
    small = b"small file"
    calls = []

    def flaky(mime, to):
        calls.append(mime)
        if len(calls) == 1:
            raise providers.ProviderError("busy", temporary=True)
        return "ok"

    monkeypatch.setattr(providers, "send", flaky)
    r = client.post("/v1/emails", headers={"Authorization": f"Bearer {key}"},
                    json={"to": "a@example.com", "subject": "s", "text": "t", "attachments": [
                        {"filename": "big.zip", "content": base64.b64encode(big).decode()},
                        {"filename": "note.txt", "content": base64.b64encode(small).decode()}]})
    mid = r.json()["id"]
    names = [b.name for b in blob.list_blobs()]
    assert any(n.startswith(f"email/pending/{mid}/") for n in names)  # waiting attachment is in Azure, not on disk
    assert any(n.startswith("email/files/") for n in names)
    with SessionLocal() as db:
        db.get(EmailMessage, mid).next_attempt_at = None
        db.commit()
    queue.process_due()  # another "server" picks it up and finds the attachment in Azure
    assert [p.get_filename() for p in calls[-1].iter_attachments()] == ["note.txt"]
    assert not any(b.name.startswith(f"email/pending/{mid}/") for b in blob.list_blobs())  # cleaned up after sending
    link = next(part for part in calls[-1].walk() if part.get_content_type() == "text/plain").get_content()
    token = link.split("/v1/files/")[1].split()[0]
    d = client.get(f"/v1/files/{token}")
    assert d.status_code == 200 and d.content == big and "attachment" in d.headers["content-disposition"]
    assert d.headers["content-security-policy"].endswith("sandbox")
