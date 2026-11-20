"""Google Drive API v3 client, acting as ThumbsUp's service account ("robot").

Customers share a folder with the robot's email (Viewer). The robot can then read
only what was shared with it, so no Google OAuth consent screen or restricted-scope
security assessment is needed.
"""

import json
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime

import httpx

from app.config import settings

API = "https://www.googleapis.com/drive/v3"
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
FOLDER_MIME = "application/vnd.google-apps.folder"
SHORTCUT_MIME = "application/vnd.google-apps.shortcut"

# Google Docs/Sheets/Slides/Drawings have no file to download: we export them.
GOOGLE_EXPORTS = {
    "application/vnd.google-apps.document": ("pdf", "application/pdf"),
    "application/vnd.google-apps.spreadsheet": ("pdf", "application/pdf"),
    "application/vnd.google-apps.presentation": ("pdf", "application/pdf"),
    "application/vnd.google-apps.drawing": ("png", "image/png"),
}

FILE_FIELDS = "id,name,mimeType,size,md5Checksum,version,modifiedTime,trashed,shortcutDetails"

FOLDER_LINK_PATTERNS = [
    re.compile(r"/folders/([A-Za-z0-9_-]{10,})"),
    re.compile(r"[?&]id=([A-Za-z0-9_-]{10,})"),
    re.compile(r"^([A-Za-z0-9_-]{20,})$"),
]


class DriveError(Exception):
    """Base error. `temporary` means: try again later."""

    def __init__(self, message: str, *, temporary: bool = False, status: int | None = None):
        super().__init__(message)
        self.temporary = temporary
        self.status = status


class DriveAccessError(DriveError):
    """The robot can't see this folder/file (not shared, deleted, or wrong link)."""


@dataclass
class DriveFile:
    id: str
    name: str
    mime_type: str
    size: int
    md5: str | None
    version: str
    modified_at: datetime | None

    @property
    def is_folder(self) -> bool:
        return self.mime_type == FOLDER_MIME

    @property
    def is_google_doc(self) -> bool:
        return self.mime_type in GOOGLE_EXPORTS


def parse_folder_id(link: str) -> str | None:
    link = (link or "").strip()
    for pattern in FOLDER_LINK_PATTERNS:
        m = pattern.search(link)
        if m:
            return m.group(1)
    return None


def load_service_account_info() -> dict:
    if settings.GOOGLE_SERVICE_ACCOUNT_JSON.strip():
        raw = settings.GOOGLE_SERVICE_ACCOUNT_JSON
    else:
        try:
            with open(settings.GOOGLE_SERVICE_ACCOUNT_FILE, encoding="utf-8") as fh:
                raw = fh.read()
        except OSError as exc:
            raise ValueError(f"can't read GOOGLE_SERVICE_ACCOUNT_FILE ({settings.GOOGLE_SERVICE_ACCOUNT_FILE})") from exc
    try:
        info = json.loads(raw)
    except ValueError as exc:
        raise ValueError("the service account key is not valid JSON") from exc
    if info.get("type") != "service_account" or not info.get("client_email") or not info.get("private_key"):
        raise ValueError("this is not a service account key (download a JSON key from Google Cloud > IAM > Service accounts)")
    return info


def service_account_email() -> str | None:
    if not settings.drive_configured:
        return None
    try:
        return load_service_account_info()["client_email"]
    except ValueError:
        return None


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _to_file(d: dict) -> DriveFile:
    return DriveFile(
        id=d["id"],
        name=d.get("name", ""),
        mime_type=d.get("mimeType", "application/octet-stream"),
        size=int(d.get("size") or 0),
        md5=d.get("md5Checksum"),
        version=str(d.get("version") or d.get("modifiedTime") or ""),
        modified_at=_parse_time(d.get("modifiedTime")),
    )


class DriveClient:
    def __init__(self, token_provider=None, transport: httpx.BaseTransport | None = None):
        self._token_provider = token_provider or _ServiceAccountTokens()
        self._http = httpx.Client(timeout=httpx.Timeout(30.0, read=120.0), transport=transport, follow_redirects=True)

    # ---------------------------------------------------------------- low level
    def _request(self, method: str, url: str, *, params=None, json_body=None, stream=False):
        for attempt in range(4):
            headers = {"Authorization": f"Bearer {self._token_provider.token()}"}
            try:
                req = self._http.build_request(method, url, params=params, json=json_body, headers=headers)
                resp = self._http.send(req, stream=stream)
            except httpx.HTTPError as exc:
                if attempt == 3:
                    raise DriveError(f"Couldn't reach Google Drive ({exc.__class__.__name__}).", temporary=True) from exc
                time.sleep(2**attempt)
                continue
            if resp.status_code in (429, 500, 502, 503, 504) or (resp.status_code == 403 and _is_rate_limit(resp)):
                resp.close()
                if attempt == 3:
                    raise DriveError("Google Drive is busy right now. Will retry.", temporary=True, status=resp.status_code)
                time.sleep(2**attempt)
                continue
            if resp.status_code in (403, 404):
                if stream:
                    resp.read()
                raise DriveAccessError(_error_text(resp), status=resp.status_code)
            if resp.status_code == 401:
                self._token_provider.invalidate()
                if attempt < 3:
                    continue
            if resp.status_code >= 400:
                if stream:
                    resp.read()
                raise DriveError(f"Google Drive error {resp.status_code}: {_error_text(resp)}", status=resp.status_code)
            return resp
        raise DriveError("Google Drive request failed.", temporary=True)

    # ---------------------------------------------------------------- files & folders
    def get(self, file_id: str) -> DriveFile:
        resp = self._request("GET", f"{API}/files/{file_id}", params={"fields": FILE_FIELDS, "supportsAllDrives": "true"})
        data = resp.json()
        if data.get("trashed"):
            raise DriveAccessError("This item is in the Drive trash.")
        return _to_file(data)

    def list_children(self, folder_id: str) -> list[DriveFile]:
        out: list[DriveFile] = []
        token = None
        while True:
            params = {
                "q": f"'{folder_id}' in parents and trashed = false",
                "fields": f"nextPageToken,files({FILE_FIELDS})",
                "pageSize": "1000",
                "supportsAllDrives": "true",
                "includeItemsFromAllDrives": "true",
            }
            if token:
                params["pageToken"] = token
            data = self._request("GET", f"{API}/files", params=params).json()
            for d in data.get("files", []):
                if d.get("mimeType") == SHORTCUT_MIME:
                    continue  # shortcuts point elsewhere; ignore for predictability
                out.append(_to_file(d))
            token = data.get("nextPageToken")
            if not token:
                return out

    def download(self, f: DriveFile, dest_path: str, max_bytes: int) -> tuple[str, int]:
        """Stream the file (or its export) to disk. Returns (content_type, size)."""
        if f.is_google_doc:
            fmt, mime = GOOGLE_EXPORTS[f.mime_type]
            resp = self._request("GET", f"{API}/files/{f.id}/export", params={"mimeType": mime}, stream=True)
            content_type = mime
        else:
            resp = self._request(
                "GET", f"{API}/files/{f.id}", params={"alt": "media", "supportsAllDrives": "true"}, stream=True
            )
            content_type = f.mime_type
        size = 0
        try:
            with open(dest_path, "wb") as fh:
                for chunk in resp.iter_bytes(1024 * 256):
                    size += len(chunk)
                    if size > max_bytes:
                        raise DriveError(f"File is larger than the {max_bytes // (1024 * 1024)} MB limit.")
                    fh.write(chunk)
        finally:
            resp.close()
        return content_type, size

    # ---------------------------------------------------------------- change feed
    def start_page_token(self) -> str:
        resp = self._request("GET", f"{API}/changes/startPageToken", params={"supportsAllDrives": "true"})
        return resp.json()["startPageToken"]

    def list_changes(self, page_token: str) -> tuple[list[dict], str]:
        """Returns (changes, new_start_token). Each change: {"fileId", "removed", "parents"}."""
        changes = []
        token = page_token
        while True:
            data = self._request(
                "GET",
                f"{API}/changes",
                params={
                    "pageToken": token,
                    "fields": "nextPageToken,newStartPageToken,changes(fileId,removed,file(parents))",
                    "pageSize": "1000",
                    "supportsAllDrives": "true",
                    "includeItemsFromAllDrives": "true",
                },
            ).json()
            for c in data.get("changes", []):
                changes.append({"fileId": c.get("fileId"), "removed": c.get("removed", False),
                                "parents": (c.get("file") or {}).get("parents", [])})
            if data.get("nextPageToken"):
                token = data["nextPageToken"]
                continue
            return changes, data.get("newStartPageToken", token)

    def watch_changes(self, page_token: str, channel_id: str, address: str, token: str, expiration_ms: int) -> dict:
        body = {"id": channel_id, "type": "web_hook", "address": address, "token": token, "expiration": expiration_ms}
        resp = self._request(
            "POST", f"{API}/changes/watch", params={"pageToken": page_token, "supportsAllDrives": "true"}, json_body=body
        )
        return resp.json()

    def stop_channel(self, channel_id: str, resource_id: str) -> None:
        try:
            self._request("POST", f"{API}/channels/stop", json_body={"id": channel_id, "resourceId": resource_id})
        except DriveError:
            pass


def _is_rate_limit(resp: httpx.Response) -> bool:
    try:
        reasons = {e.get("reason") for e in resp.json().get("error", {}).get("errors", [])}
    except ValueError:
        return False
    return bool(reasons & {"rateLimitExceeded", "userRateLimitExceeded", "backendError"})


def _error_text(resp: httpx.Response) -> str:
    try:
        return resp.json().get("error", {}).get("message", resp.reason_phrase)
    except ValueError:
        return resp.reason_phrase


class _ServiceAccountTokens:
    """OAuth access tokens for the service account, refreshed automatically."""

    def __init__(self):
        self._lock = threading.Lock()
        self._creds = None

    def _credentials(self):
        if self._creds is None:
            from google.oauth2 import service_account

            self._creds = service_account.Credentials.from_service_account_info(load_service_account_info(), scopes=SCOPES)
        return self._creds

    def token(self) -> str:
        from google.auth.transport.requests import Request

        with self._lock:
            creds = self._credentials()
            if not creds.valid:
                try:
                    creds.refresh(Request())
                except Exception as exc:  # noqa: BLE001
                    raise DriveError(f"Google rejected the service account key: {exc}") from exc
            return creds.token

    def invalidate(self) -> None:
        with self._lock:
            if self._creds is not None:
                self._creds.token = None


_client: DriveClient | None = None
_client_lock = threading.Lock()


def get_client() -> DriveClient:
    """Shared client (tests replace it with a fake via set_client)."""
    global _client
    with _client_lock:
        if _client is None:
            if not settings.drive_configured:
                raise DriveError("Drive Assets isn't set up on this server yet (no Google service account).")
            _client = DriveClient()
        return _client


def set_client(client) -> None:
    global _client
    _client = client
