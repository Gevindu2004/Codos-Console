"""Drive Assets: connect a Drive folder, serve files by name, replace them from Drive."""

import io
from datetime import datetime, timedelta, timezone

import pytest
from fake_drive import FakeDrive
from PIL import Image

from app.db import SessionLocal
from app.models import AssetFile, AssetProject
from app.services import asset_sync, drive
from app.services.asset_storage import reset_storage


@pytest.fixture
def gdrive():
    fake = FakeDrive()
    drive.set_client(fake)
    reset_storage()
    yield fake
    drive.set_client(None)


def png(w=1200, h=800, color=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def prove(c, gdrive, folder):
    """What a real user does once per folder: add the account's verification file."""
    gdrive.upload(folder, c.get("/dashboard/assets/config").json()["verification_file"], b"", "text/plain")


def connect(c, gdrive, name="Acme Website", **body):
    folder = gdrive.folder(name, share=True)
    prove(c, gdrive, folder)
    r = c.post("/dashboard/assets/projects", json={"folder_link": f"https://drive.google.com/drive/folders/{folder}?usp=sharing", **body})
    assert r.status_code == 201, r.text
    return folder, r.json()["data"]


def sync(project_id):
    with SessionLocal() as db:
        db.get(AssetProject, project_id).sync_requested = True
        db.commit()
    assert asset_sync.sync_project(project_id)


def events(c, pid):
    return [(e["kind"], e["path"]) for e in c.get(f"/dashboard/assets/projects/{pid}/events").json()["data"]]


# ---------------------------------------------------------------- connecting a folder
def test_config_shows_robot_email(alice):
    cfg = alice.get("/dashboard/assets/config").json()
    assert cfg["configured"] is True and cfg["robot_email"] == "robot@thumbsup-test.iam.gserviceaccount.com"


def test_folder_must_be_shared_with_robot(alice, gdrive):
    private = gdrive.folder("Secret", share=False)
    r = alice.post("/dashboard/assets/projects", json={"folder_link": f"https://drive.google.com/drive/folders/{private}"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "folder_not_shared"
    assert "robot@thumbsup-test.iam.gserviceaccount.com" in r.json()["error"]["hint"]


def test_bad_links_and_files_rejected(alice, gdrive):
    assert alice.post("/dashboard/assets/projects", json={"folder_link": "https://example.com/hello"}).status_code == 422
    root = gdrive.folder("Root", share=True)
    f = gdrive.upload(root, "hero.jpg")
    r = alice.post("/dashboard/assets/projects", json={"folder_link": f"https://drive.google.com/file/d/{f}/view?id={f}"})
    assert r.json()["error"]["code"] == "not_a_folder"


def test_connect_copies_files_and_serves_by_name(client, alice, gdrive):
    folder = gdrive.folder("Acme Website", share=True)
    gdrive.upload(folder, "hero.jpg", b"HERO-V1")
    gdrive.upload(folder, "logo.png", png(64, 64), "image/png")
    sub = gdrive.folder("team", parent=folder)
    gdrive.upload(sub, "Nimal.jpg", b"NIMAL")
    prove(alice, gdrive, folder)
    r = alice.post("/dashboard/assets/projects", json={"folder_link": f"https://drive.google.com/drive/folders/{folder}"})
    p = r.json()["data"]
    assert p["slug"] == "acme-website" and p["base_url"].endswith("/a/acme-website/")

    files = alice.get(f"/dashboard/assets/projects/{p['id']}/files").json()["data"]
    assert sorted(f["path"] for f in files) == ["hero.jpg", "logo.png", "team/Nimal.jpg"]
    assert alice.get(f"/dashboard/assets/projects/{p['id']}").json()["data"]["status"] == "active"

    r = client.get("/a/acme-website/hero.jpg")  # public: no key, no login
    assert r.status_code == 200 and r.content == b"HERO-V1" and r.headers["content-type"] == "image/jpeg"
    assert client.get("/a/acme-website/HERO.JPG").content == b"HERO-V1"  # names aren't case-sensitive
    assert client.get("/a/acme-website/team/nimal.jpg").content == b"NIMAL"  # subfolders keep their path
    assert client.get("/a/acme-website/hero").content == b"HERO-V1"  # extension is optional
    assert client.get("/a/acme-website/missing.jpg").status_code == 404
    assert client.get("/a/no-such-project/hero.jpg").status_code == 404


def test_same_name_replacement_flow(client, alice, gdrive):
    """The main promise: client deletes hero.jpg, uploads a new hero.jpg, the website changes."""
    folder, p = connect(alice, gdrive)
    old = gdrive.upload(folder, "hero.jpg", b"OLD-HERO")
    sync(p["id"])
    assert client.get("/a/acme-website/hero.jpg").content == b"OLD-HERO"

    gdrive.delete(old)
    sync(p["id"])
    # in the gap between deleting and uploading, the old image is still served (no broken website)
    assert client.get("/a/acme-website/hero.jpg").content == b"OLD-HERO"
    files = alice.get(f"/dashboard/assets/projects/{p['id']}/files").json()["data"]
    assert files[0]["status"] == "removed" and files[0]["grace_ends_at"]

    gdrive.upload(folder, "hero.jpg", b"NEW-HERO")
    sync(p["id"])
    assert client.get("/a/acme-website/hero.jpg").content == b"NEW-HERO"
    assert ("replaced", "hero.jpg") in events(alice, p["id"])
    assert len(alice.get(f"/dashboard/assets/projects/{p['id']}/files").json()["data"]) == 1  # old copy cleaned up


def test_new_version_of_same_file(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    fid = gdrive.upload(folder, "menu.pdf", b"MENU-1", "application/pdf")
    sync(p["id"])
    first = client.get("/a/acme-website/menu.pdf")
    gdrive.new_version(fid, b"MENU-2")  # Drive: Manage versions -> Upload new version
    sync(p["id"])
    second = client.get("/a/acme-website/menu.pdf")
    assert second.content == b"MENU-2" and first.headers["etag"] != second.headers["etag"]
    assert ("updated", "menu.pdf") in events(alice, p["id"])


def test_deleted_without_replacement_disappears_after_grace(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    fid = gdrive.upload(folder, "promo.jpg", b"PROMO")
    sync(p["id"])
    gdrive.delete(fid)
    sync(p["id"])
    assert client.get("/a/acme-website/promo.jpg").status_code == 200
    with SessionLocal() as db:
        f = db.query(AssetFile).filter_by(project_id=p["id"]).one()
        f.removed_at = datetime.now(timezone.utc) - timedelta(minutes=31)
        db.commit()
    assert client.get("/a/acme-website/promo.jpg").status_code == 404
    sync(p["id"])
    assert alice.get(f"/dashboard/assets/projects/{p['id']}/files").json()["data"] == []


def test_duplicate_names_newest_wins_with_warning(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "hero.jpg", b"FIRST")
    sync(p["id"])
    gdrive.upload(folder, "hero.jpg", b"SECOND")  # uploaded before deleting the old one
    sync(p["id"])
    assert client.get("/a/acme-website/hero.jpg").content == b"SECOND"
    assert ("conflict", "hero.jpg") in events(alice, p["id"])
    assert alice.get(f"/dashboard/assets/projects/{p['id']}/files").json()["duplicates"] == ["hero.jpg"]


def test_drive_copy_name_hint(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "hero.jpg", b"A")
    sync(p["id"])
    gdrive.upload(folder, "hero (1).jpg", b"B")
    sync(p["id"])
    assert ("hint", "hero (1).jpg") in events(alice, p["id"])


def test_rename(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    fid = gdrive.upload(folder, "banner.jpg", b"BANNER")
    sync(p["id"])
    gdrive.rename(fid, "header.jpg")
    sync(p["id"])
    assert client.get("/a/acme-website/header.jpg").content == b"BANNER"
    assert client.get("/a/acme-website/banner.jpg").status_code == 404
    assert gdrive.downloads == 1  # rename doesn't re-download


def test_google_doc_served_as_pdf(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "Price List", b"prices", "application/vnd.google-apps.document")
    sync(p["id"])
    for path in ("price%20list", "Price%20List.pdf"):
        r = client.get(f"/a/acme-website/{path}")
        assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content.startswith(b"%PDF")


def test_dangerous_and_huge_files_not_served(client, alice, gdrive, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "ASSET_MAX_FILE_MB", 1)
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "setup.exe", b"MZ", "application/octet-stream")
    gdrive.upload(folder, "huge.mp4", b"x" * (1024 * 1024 + 1), "video/mp4")
    sync(p["id"])
    statuses = {f["path"]: f["status"] for f in alice.get(f"/dashboard/assets/projects/{p['id']}/files").json()["data"]}
    assert statuses == {"setup.exe": "blocked", "huge.mp4": "too_large"}
    assert client.get("/a/acme-website/setup.exe").status_code == 404


def test_access_lost_keeps_serving_last_copy(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "hero.jpg", b"HERO")
    sync(p["id"])
    gdrive.unshare(folder)
    sync(p["id"])
    proj = alice.get(f"/dashboard/assets/projects/{p['id']}").json()["data"]
    assert proj["status"] == "no_access"
    assert client.get("/a/acme-website/hero.jpg").content == b"HERO"  # website keeps working
    assert ("access_lost", "") in events(alice, p["id"])
    gdrive.shared.add(folder)
    sync(p["id"])
    assert alice.get(f"/dashboard/assets/projects/{p['id']}").json()["data"]["status"] == "active"


# ---------------------------------------------------------------- serving details
def test_image_resize_and_webp(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "hero.png", png(1600, 900), "image/png")
    sync(p["id"])
    r = client.get("/a/acme-website/hero.png?w=777&format=webp")
    assert r.status_code == 200 and r.headers["content-type"] == "image/webp"
    img = Image.open(io.BytesIO(r.content))
    assert img.width == 800 and img.height == 450  # rounded up to 50px steps, aspect kept
    r2 = client.get("/a/acme-website/hero.png?w=300&h=300", headers={"Accept": "image/avif,image/webp,*/*"})
    assert r2.headers["content-type"] == "image/avif" and Image.open(io.BytesIO(r2.content)).size == (300, 300)
    assert client.get("/a/acme-website/hero.png?w=99999").status_code == 400
    small = client.get("/a/acme-website/hero.png?w=4000")  # never upscales
    assert Image.open(io.BytesIO(small.content)).width == 1600


def test_caching_headers_and_304(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "logo.png", png(10, 10), "image/png")
    sync(p["id"])
    r = client.get("/a/acme-website/logo.png")
    assert "max-age=60" in r.headers["cache-control"] and r.headers["access-control-allow-origin"] == "*"
    assert "x-frame-options" not in r.headers  # can be embedded on the customer's site
    again = client.get("/a/acme-website/logo.png", headers={"If-None-Match": r.headers["etag"]})
    assert again.status_code == 304


def test_video_byte_ranges(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "intro.mp4", bytes(range(256)) * 40, "video/mp4")
    sync(p["id"])
    r = client.get("/a/acme-website/intro.mp4", headers={"Range": "bytes=100-199"})
    assert r.status_code == 206 and len(r.content) == 100 and r.content == (bytes(range(256)) * 40)[100:200]


def test_svg_and_html_cannot_run_scripts(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "icon.svg", b"<svg><script>alert(1)</script></svg>", "image/svg+xml")
    gdrive.upload(folder, "page.html", b"<script>alert(1)</script>", "text/html")
    sync(p["id"])
    svg = client.get("/a/acme-website/icon.svg")
    assert "sandbox" in svg.headers["content-security-policy"] and "script-src" not in svg.headers["content-security-policy"]
    assert client.get("/a/acme-website/page.html").headers["content-disposition"].startswith("attachment")


def test_path_traversal_rejected(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    sync(p["id"])
    assert client.get("/a/acme-website/../../etc/passwd").status_code == 404
    assert client.get("/a/acme-website/%2e%2e/%2e%2e/etc/passwd").status_code == 404


def test_usage_counted(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "a.jpg", b"12345")
    sync(p["id"])
    for _ in range(3):
        client.get("/a/acme-website/a.jpg")
    u = alice.get(f"/dashboard/assets/projects/{p['id']}/usage").json()
    assert u["last_30_days"]["hits"] == 3 and u["last_30_days"]["bytes"] == 15


# ---------------------------------------------------------------- security & ownership
def test_projects_are_private(client, alice, bob, gdrive):
    folder, p = connect(alice, gdrive)
    assert bob.get("/dashboard/assets/projects").json()["data"] == []
    for method, url in [("get", ""), ("get", "/files"), ("get", "/events"), ("post", "/sync"), ("delete", "")]:
        assert getattr(bob, method)(f"/dashboard/assets/projects/{p['id']}{url}").status_code == 404
    assert bob.patch(f"/dashboard/assets/projects/{p['id']}", json={"slug": "stolen"}).status_code == 404


def test_one_folder_one_owner(alice, bob, gdrive):
    folder, p = connect(alice, gdrive)
    r = bob.post("/dashboard/assets/projects", json={"folder_link": folder})
    assert r.status_code == 409 and r.json()["error"]["code"] == "folder_taken"


def test_unverified_claim_does_not_block_the_real_owner(alice, bob, gdrive):
    folder = gdrive.folder("Client site", share=True)
    squatter = bob.post("/dashboard/assets/projects", json={"folder_link": folder, "slug": "squat"}).json()["data"]
    assert bob.get(f"/dashboard/assets/projects/{squatter['id']}").json()["data"]["status"] == "needs_verification"
    prove(alice, gdrive, folder)
    real = alice.post("/dashboard/assets/projects", json={"folder_link": folder}).json()["data"]
    assert alice.get(f"/dashboard/assets/projects/{real['id']}").json()["data"]["status"] == "active"
    sync(squatter["id"])  # bob can't ever verify: the file in the folder is Alice's
    assert bob.get(f"/dashboard/assets/projects/{squatter['id']}").json()["data"]["status"] == "needs_verification"


def test_slugs_unique_and_validated(alice, bob, gdrive):
    connect(alice, gdrive, slug="acme-shop")
    other = gdrive.folder("Other", share=True)
    prove(bob, gdrive, other)
    r = bob.post("/dashboard/assets/projects", json={"folder_link": other, "slug": "acme-shop"})
    assert r.status_code == 409
    assert bob.post("/dashboard/assets/projects", json={"folder_link": other, "slug": "Bad Slug!"}).status_code == 422
    assert bob.post("/dashboard/assets/projects", json={"folder_link": other, "slug": "admin"}).status_code == 422
    ok = bob.post("/dashboard/assets/projects", json={"folder_link": other}).json()["data"]
    assert ok["slug"] == "other"


def test_developer_api_with_secret_key(client, alice, bob, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "hero.jpg", b"H")
    sync(p["id"])
    key = alice.post("/dashboard/keys", json={"name": "s", "kind": "secret"}).json()["data"]["key"]
    auth = {"Authorization": f"Bearer {key}"}
    assert client.get("/v1/assets/projects", headers=auth).json()["data"][0]["slug"] == "acme-website"
    files = client.get("/v1/assets/projects/acme-website/files", headers=auth).json()["data"]
    assert files[0]["url"].endswith("/a/acme-website/hero.jpg")
    assert client.post("/v1/assets/projects/acme-website/sync", headers=auth).status_code == 202
    bob_key = bob.post("/dashboard/keys", json={"name": "s", "kind": "secret"}).json()["data"]["key"]
    assert client.get("/v1/assets/projects/acme-website/files", headers={"Authorization": f"Bearer {bob_key}"}).status_code == 404
    assert client.get("/v1/assets/projects").status_code == 401


def test_delete_project_removes_files(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    gdrive.upload(folder, "hero.jpg", b"H")
    sync(p["id"])
    alice.delete(f"/dashboard/assets/projects/{p['id']}")
    assert client.get("/a/acme-website/hero.jpg").status_code == 404
    assert alice.post("/dashboard/assets/projects", json={"folder_link": folder}).status_code == 201  # can reconnect


def test_verification_file_never_listed_or_served(client, alice, gdrive):
    folder, p = connect(alice, gdrive)
    paths = [f["path"] for f in alice.get(f"/dashboard/assets/projects/{p['id']}/files").json()["data"]]
    assert not any(x.startswith("thumbsup-verify-") for x in paths)
    assert ("verified", "") in events(alice, p["id"])


# ---------------------------------------------------------------- change detection
def test_change_feed_flags_only_affected_projects(client, alice, bob, gdrive):
    fa, pa = connect(alice, gdrive, name="Alpha")
    fb, pb = connect(bob, gdrive, name="Beta")
    sub = gdrive.folder("img", parent=fa)
    sync(pa["id"])
    sync(pb["id"])
    asset_sync.check_changes()  # first call just remembers the position
    gdrive.upload(sub, "new.jpg", b"N")  # change deep inside Alpha's subfolder
    assert asset_sync.check_changes() == 1
    with SessionLocal() as db:
        assert db.get(AssetProject, pa["id"]).sync_requested is True
        assert db.get(AssetProject, pb["id"]).sync_requested is False


def test_google_push_notification_needs_secret_token(client, gdrive):
    assert client.post("/v1/providers/google/drive", headers={"X-Goog-Channel-Token": "wrong"}).status_code == 404
    good = client.post("/v1/providers/google/drive", headers={"X-Goog-Channel-Token": asset_sync.push_token()})
    assert good.status_code == 200


def test_sync_claim_prevents_double_runs(alice, gdrive):
    folder, p = connect(alice, gdrive)
    with SessionLocal() as db:
        db.get(AssetProject, p["id"]).sync_started_at = datetime.now(timezone.utc)
        db.commit()
    assert asset_sync.sync_project(p["id"]) is False
