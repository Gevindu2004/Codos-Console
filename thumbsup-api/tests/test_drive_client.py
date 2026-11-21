"""The real Google Drive HTTP client, against recorded-shape responses (no network)."""

import json

import httpx
import pytest

from app.services import drive


class Tokens:
    def __init__(self):
        self.n = 0

    def token(self):
        self.n += 1
        return f"tok{self.n}"

    def invalidate(self):
        pass


def client_with(handler):
    return drive.DriveClient(token_provider=Tokens(), transport=httpx.MockTransport(handler))


def test_parse_folder_links():
    fid = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345"
    for link in (f"https://drive.google.com/drive/folders/{fid}?usp=sharing",
                 f"https://drive.google.com/drive/u/0/folders/{fid}",
                 f"https://drive.google.com/open?id={fid}", fid):
        assert drive.parse_folder_id(link) == fid
    assert drive.parse_folder_id("https://example.com") is None


def test_list_children_follows_pages_and_skips_shortcuts():
    calls = []

    def handler(req):
        calls.append(req)
        assert req.headers["authorization"].startswith("Bearer tok")
        assert "'F1' in parents" in req.url.params["q"]
        if "pageToken" not in req.url.params:
            return httpx.Response(200, json={"nextPageToken": "p2", "files": [
                {"id": "a", "name": "hero.jpg", "mimeType": "image/jpeg", "size": "10", "version": "3",
                 "modifiedTime": "2026-11-20T10:00:00.000Z"},
                {"id": "s", "name": "link", "mimeType": drive.SHORTCUT_MIME}]})
        return httpx.Response(200, json={"files": [{"id": "b", "name": "docs", "mimeType": drive.FOLDER_MIME}]})

    out = client_with(handler).list_children("F1")
    assert [f.id for f in out] == ["a", "b"] and out[0].size == 10 and out[0].version == "3" and out[1].is_folder
    assert len(calls) == 2


def test_download_and_export(tmp_path):
    def handler(req):
        if req.url.path.endswith("/export"):
            assert req.url.params["mimeType"] == "application/pdf"
            return httpx.Response(200, content=b"%PDF-doc")
        assert req.url.params["alt"] == "media"
        return httpx.Response(200, content=b"IMAGEBYTES")

    c = client_with(handler)
    f = drive.DriveFile("x", "hero.jpg", "image/jpeg", 10, None, "1", None)
    assert c.download(f, str(tmp_path / "a"), 1000) == ("image/jpeg", 10)
    doc = drive.DriveFile("d", "Menu", "application/vnd.google-apps.document", 0, None, "1", None)
    assert c.download(doc, str(tmp_path / "b"), 1000) == ("application/pdf", 8)
    with pytest.raises(drive.DriveError, match="larger than"):
        c.download(f, str(tmp_path / "c"), 5)


def test_not_shared_is_access_error():
    c = client_with(lambda req: httpx.Response(404, json={"error": {"message": "File not found: X."}}))
    with pytest.raises(drive.DriveAccessError, match="File not found"):
        c.get("X")


def test_rate_limit_is_retried(monkeypatch):
    monkeypatch.setattr(drive.time, "sleep", lambda s: None)
    state = {"n": 0}

    def handler(req):
        state["n"] += 1
        if state["n"] < 3:
            return httpx.Response(403, json={"error": {"errors": [{"reason": "userRateLimitExceeded"}], "message": "slow down"}})
        return httpx.Response(200, json={"id": "F", "name": "Site", "mimeType": drive.FOLDER_MIME})

    assert client_with(handler).get("F").name == "Site" and state["n"] == 3


def test_google_outage_becomes_temporary_error(monkeypatch):
    monkeypatch.setattr(drive.time, "sleep", lambda s: None)
    c = client_with(lambda req: httpx.Response(503))
    with pytest.raises(drive.DriveError) as err:
        c.get("F")
    assert err.value.temporary


def test_trashed_folder_counts_as_gone():
    c = client_with(lambda req: httpx.Response(200, json={"id": "F", "name": "x", "mimeType": drive.FOLDER_MIME, "trashed": True}))
    with pytest.raises(drive.DriveAccessError):
        c.get("F")


def test_change_feed_and_watch():
    def handler(req):
        if req.url.path.endswith("startPageToken"):
            return httpx.Response(200, json={"startPageToken": "100"})
        if req.url.path.endswith("/changes/watch"):
            body = json.loads(req.content)
            assert body["type"] == "web_hook" and body["address"].startswith("https://")
            return httpx.Response(200, json={"resourceId": "R", "expiration": "123"})
        return httpx.Response(200, json={"newStartPageToken": "105", "changes": [
            {"fileId": "a", "removed": False, "file": {"parents": ["F1"]}}, {"fileId": "b", "removed": True}]})

    c = client_with(handler)
    assert c.start_page_token() == "100"
    changes, token = c.list_changes("100")
    assert token == "105" and changes[0]["parents"] == ["F1"] and changes[1]["removed"]
    assert c.watch_changes("100", "ch", "https://api.example.com/v1/providers/google/drive", "t", 1)["resourceId"] == "R"


def test_service_account_key_validation(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "GOOGLE_SERVICE_ACCOUNT_JSON", '{"type": "authorized_user"}')
    with pytest.raises(ValueError, match="not a service account"):
        drive.load_service_account_info()
    monkeypatch.setattr(settings, "GOOGLE_SERVICE_ACCOUNT_JSON", "not json")
    with pytest.raises(ValueError, match="not valid JSON"):
        drive.load_service_account_info()
