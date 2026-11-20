"""Serving from S3 / Cloudflare R2 storage (byte ranges for video)."""

import boto3
import pytest
from fake_drive import FakeDrive
from moto import mock_aws

from app.config import settings
from app.services import asset_sync, drive
from app.services.asset_storage import reset_storage


@pytest.fixture
def s3(monkeypatch):
    with mock_aws():
        for k, v in dict(ASSET_STORAGE="s3", S3_BUCKET="tu-assets", S3_ACCESS_KEY_ID="x", S3_SECRET_ACCESS_KEY="y",
                         S3_REGION="us-east-1", S3_ENDPOINT_URL="").items():
            monkeypatch.setattr(settings, k, v)
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="tu-assets")
        reset_storage()
        yield
        reset_storage()


def test_s3_storage_end_to_end(client, alice, s3):
    fake = FakeDrive()
    drive.set_client(fake)
    try:
        folder = fake.folder("Site", share=True)
        video = bytes(range(256)) * 100
        fake.upload(folder, "intro.mp4", video, "video/mp4")
        fid = fake.upload(folder, "hero.jpg", b"OLD")
        fake.upload(folder, alice.get("/dashboard/assets/config").json()["verification_file"], b"", "text/plain")
        p = alice.post("/dashboard/assets/projects", json={"folder_link": folder}).json()["data"]
        assert client.get("/a/site/hero.jpg").content == b"OLD"
        r = client.get("/a/site/intro.mp4", headers={"Range": "bytes=1000-1999"})
        assert r.status_code == 206 and r.content == video[1000:2000] and r.headers["content-range"].startswith("bytes 1000-1999/")
        assert client.get("/a/site/intro.mp4").content == video

        fake.new_version(fid, b"NEW")
        asset_sync.request_sync(p["id"])
        asset_sync.sync_project(p["id"])
        assert client.get("/a/site/hero.jpg").content == b"NEW"
        keys = [o["Key"] for o in boto3.client("s3", region_name="us-east-1").list_objects_v2(Bucket="tu-assets")["Contents"]]
        assert len(keys) == 2  # the old hero copy was deleted from storage
        alice.delete(f"/dashboard/assets/projects/{p['id']}")
        assert boto3.client("s3", region_name="us-east-1").list_objects_v2(Bucket="tu-assets").get("KeyCount") == 0
    finally:
        drive.set_client(None)
