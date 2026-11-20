"""Google Sheets API v4 client + "Sign in with Google" (OAuth) helpers.

Two ways to reach a customer's spreadsheet:
  oauth  the customer signed in with Google and gave us the drive.file permission:
         we can open ONLY the spreadsheets they created or picked through ThumbsUp.
         Google's per-user limit (60 writes/minute) then applies to each customer separately.
  robot  the customer shared the sheet with our service account (like Drive Assets).
         Easy, but every customer shares the robot's single 60 writes/minute.

Every request is counted locally so we stay under Google's limits instead of hitting 429s.
"""

import base64
import json
import threading
import time
import urllib.parse
from collections import deque
from dataclasses import dataclass, field

import httpx

from app.config import settings

SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
OAUTH_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"]
ROBOT_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

_sleep = time.sleep  # tests replace it so retries don't slow them down

# Tests swap this for an in-memory fake Google.
_transport: httpx.BaseTransport | None = None


def set_transport(transport: httpx.BaseTransport | None) -> None:
    global _transport
    _transport = transport
    _clients.clear()
    _robot_tokens.clear()
    _access_cache.clear()


def _http(timeout: float = 30.0) -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(timeout, read=90.0), transport=_transport)


# ====================================================================== errors
class SheetsError(Exception):
    def __init__(self, message: str, *, temporary: bool = False, status: int | None = None):
        super().__init__(message)
        self.temporary = temporary
        self.status = status


class SheetsAccessError(SheetsError):
    """The spreadsheet is gone, or we no longer have permission."""


class SheetsAuthError(SheetsError):
    """The customer removed ThumbsUp's access to their Google account."""


# ====================================================================== A1 helpers
def col_letter(index: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA"""
    s = ""
    n = index + 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def quote_tab(title: str) -> str:
    return "'" + title.replace("'", "''") + "'"


def parse_spreadsheet_id(link: str) -> str | None:
    import re

    link = (link or "").strip()
    for pat in (r"/spreadsheets/d/([A-Za-z0-9_-]{20,})", r"^([A-Za-z0-9_-]{25,})$"):
        m = re.search(pat, link)
        if m:
            return m.group(1)
    return None


# ====================================================================== rate guard
class _Budget:
    """Sliding one-minute window per Google account."""

    def __init__(self):
        self._lock = threading.Lock()
        self._hits: dict[str, deque] = {}

    def take(self, key: str, limit: int, max_wait: float) -> None:
        deadline = time.monotonic() + max_wait
        while True:
            with self._lock:
                q = self._hits.setdefault(key, deque())
                now = time.monotonic()
                while q and now - q[0] >= 60:
                    q.popleft()
                if len(q) < limit:
                    q.append(now)
                    return
                wait = 60 - (now - q[0]) + 0.05
            if time.monotonic() + wait > deadline:
                raise SheetsError(
                    "Google's speed limit for this account is reached. The change is queued and will be retried.",
                    temporary=True,
                    status=429,
                )
            _sleep(min(wait, 1.0))

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


budget = _Budget()


# ====================================================================== tokens
@dataclass
class _Cached:
    token: str
    expires: float


_access_cache: dict[str, _Cached] = {}
_access_lock = threading.Lock()


def oauth_refresh(refresh_token: str) -> tuple[str, int]:
    with _http() as http:
        try:
            resp = http.post(
                TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                    "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
        except httpx.HTTPError as exc:
            raise SheetsError("Couldn't reach Google sign-in.", temporary=True) from exc
    if resp.status_code == 400 and _json(resp).get("error") in ("invalid_grant", "unauthorized_client"):
        raise SheetsAuthError("Access to the Google account was removed. Reconnect it in ThumbsUp.")
    if resp.status_code != 200:
        raise SheetsError(f"Google sign-in error {resp.status_code}.", temporary=resp.status_code >= 500)
    data = resp.json()
    return data["access_token"], int(data.get("expires_in", 3600))


class OAuthTokens:
    """Access tokens for one customer's Google account, from their stored refresh token."""

    def __init__(self, connection_id: str, refresh_token: str):
        self.key = f"oauth:{connection_id}"
        self._refresh_token = refresh_token

    def token(self) -> str:
        with _access_lock:
            c = _access_cache.get(self.key)
            if c and c.expires - 120 > time.time():
                return c.token
        token, ttl = oauth_refresh(self._refresh_token)
        with _access_lock:
            _access_cache[self.key] = _Cached(token, time.time() + ttl)
        return token

    def invalidate(self) -> None:
        with _access_lock:
            _access_cache.pop(self.key, None)


_robot_tokens: dict[str, object] = {}


class RobotTokens:
    """The ThumbsUp service account, with the spreadsheets permission."""

    key = "robot"

    def __init__(self):
        self._lock = threading.Lock()

    def _creds(self):
        if "creds" not in _robot_tokens:
            from google.oauth2 import service_account

            from app.services.drive import load_service_account_info

            _robot_tokens["creds"] = service_account.Credentials.from_service_account_info(
                load_service_account_info(), scopes=ROBOT_SCOPES
            )
        return _robot_tokens["creds"]

    def token(self) -> str:
        if "static" in _robot_tokens:  # tests
            return _robot_tokens["static"]
        from google.auth.transport.requests import Request

        with self._lock:
            creds = self._creds()
            if not creds.valid:
                try:
                    creds.refresh(Request())
                except Exception as exc:  # noqa: BLE001
                    raise SheetsError(f"Google rejected the service account key: {exc}") from exc
            return creds.token

    def invalidate(self) -> None:
        creds = _robot_tokens.get("creds")
        if creds is not None:
            creds.token = None


# ====================================================================== client
@dataclass
class Tab:
    gid: int
    title: str
    index: int = 0
    rows: int = 1000
    cols: int = 26


@dataclass
class SpreadsheetInfo:
    id: str
    title: str
    tabs: list[Tab] = field(default_factory=list)

    def tab_by_gid(self, gid: int) -> Tab | None:
        return next((t for t in self.tabs if t.gid == gid), None)


class SheetsClient:
    def __init__(self, tokens):
        self.tokens = tokens
        self.account_key = tokens.key

    # ---------------------------------------------------------------- low level
    def _request(self, method: str, url: str, *, kind: str, params=None, body=None, wait: float = 20.0) -> dict:
        limit = settings.SHEETS_WRITES_PER_MINUTE if kind == "write" else settings.SHEETS_READS_PER_MINUTE
        budget.take(f"{self.account_key}:{kind}", limit, wait)
        for attempt in range(4):
            headers = {"Authorization": f"Bearer {self.tokens.token()}"}
            try:
                with _http() as http:
                    resp = http.request(method, url, params=params, json=body, headers=headers)
            except httpx.HTTPError as exc:
                if attempt == 3:
                    raise SheetsError("Couldn't reach Google Sheets.", temporary=True) from exc
                _sleep(min(2**attempt, 4))
                continue
            if resp.status_code == 401 and attempt < 3:
                self.tokens.invalidate()
                continue
            if resp.status_code in (429, 500, 502, 503, 504):
                if attempt == 3:
                    raise SheetsError(
                        "Google Sheets is busy. The change is queued and will be retried.", temporary=True, status=resp.status_code
                    )
                _sleep(min(2**attempt, 8))
                continue
            if resp.status_code in (403, 404):
                raise SheetsAccessError(_error_text(resp), status=resp.status_code)
            if resp.status_code >= 400:
                raise SheetsError(f"Google Sheets error: {_error_text(resp)}", status=resp.status_code)
            return resp.json() if resp.content else {}
        raise SheetsError("Google Sheets request failed.", temporary=True)

    # ---------------------------------------------------------------- spreadsheets
    def create(self, title: str) -> SpreadsheetInfo:
        data = self._request(
            "POST", SHEETS_API, kind="write", body={"properties": {"title": title}, "sheets": [{"properties": {"title": "Sheet1"}}]}
        )
        return _info(data)

    def get(self, spreadsheet_id: str) -> SpreadsheetInfo:
        data = self._request(
            "GET",
            f"{SHEETS_API}/{spreadsheet_id}",
            kind="read",
            params={"fields": "spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties)"},
        )
        return _info(data)

    def batch_update(self, spreadsheet_id: str, requests: list[dict], wait: float = 20.0) -> list[dict]:
        if not requests:
            return []
        data = self._request(
            "POST", f"{SHEETS_API}/{spreadsheet_id}:batchUpdate", kind="write", body={"requests": requests}, wait=wait
        )
        return data.get("replies", [])

    # ---------------------------------------------------------------- values
    def get_values(self, spreadsheet_id: str, a1: str) -> list[list]:
        data = self._request(
            "GET",
            f"{SHEETS_API}/{spreadsheet_id}/values/{urllib.parse.quote(a1, safe='')}",
            kind="read",
            params={"valueRenderOption": "UNFORMATTED_VALUE", "dateTimeRenderOption": "FORMATTED_STRING"},
        )
        return data.get("values", [])

    def append_rows(self, spreadsheet_id: str, a1: str, rows: list[list], wait: float = 20.0) -> None:
        # RAW: text is stored exactly as sent. "=SUM(...)" stays text and can't run as a formula.
        self._request(
            "POST",
            f"{SHEETS_API}/{spreadsheet_id}/values/{urllib.parse.quote(a1, safe='')}:append",
            kind="write",
            params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"},
            body={"values": rows},
            wait=wait,
        )

    def update_values(self, spreadsheet_id: str, data: list[tuple[str, list[list]]], wait: float = 20.0) -> None:
        if not data:
            return
        self._request(
            "POST",
            f"{SHEETS_API}/{spreadsheet_id}/values:batchUpdate",
            kind="write",
            body={"valueInputOption": "RAW", "data": [{"range": r, "values": v} for r, v in data]},
            wait=wait,
        )


def _info(data: dict) -> SpreadsheetInfo:
    tabs = []
    for s in data.get("sheets", []):
        p = s.get("properties", {})
        g = p.get("gridProperties", {})
        tabs.append(Tab(int(p.get("sheetId", 0)), p.get("title", ""), int(p.get("index", 0)),
                        int(g.get("rowCount", 1000)), int(g.get("columnCount", 26))))
    return SpreadsheetInfo(data.get("spreadsheetId", ""), data.get("properties", {}).get("title", ""), tabs)


def _json(resp: httpx.Response) -> dict:
    try:
        v = resp.json()
        return v if isinstance(v, dict) else {}
    except ValueError:
        return {}


def _error_text(resp: httpx.Response) -> str:
    err = _json(resp).get("error")
    if isinstance(err, dict):
        return str(err.get("message", resp.reason_phrase))[:300]
    return resp.reason_phrase


# ====================================================================== clients per account
_clients: dict[str, SheetsClient] = {}
_clients_lock = threading.Lock()


def client_for(db_obj, connection=None) -> SheetsClient:
    """SheetsClient for a SheetDatabase (robot, or the customer's own Google account)."""
    if db_obj.auth_mode == "robot":
        if not settings.sheets_robot_configured:
            raise SheetsError("The robot connection isn't set up on this server.")
        with _clients_lock:
            if "robot" not in _clients:
                _clients["robot"] = SheetsClient(RobotTokens())
            return _clients["robot"]
    if connection is None or connection.status != "active":
        raise SheetsAuthError("The Google account for this sheet is disconnected. Reconnect it in ThumbsUp.")
    return oauth_client(connection)


def oauth_client(connection) -> SheetsClient:
    from app.services.crypto import decrypt

    with _clients_lock:
        c = _clients.get(connection.id)
        if c is None:
            try:
                refresh_token = decrypt(connection.refresh_token_enc)
            except (ValueError, RuntimeError) as exc:
                raise SheetsAuthError("The saved Google sign-in can't be read any more. Reconnect the Google account.") from exc
            c = SheetsClient(OAuthTokens(connection.id, refresh_token))
            _clients[connection.id] = c
        return c


def forget_client(connection_id: str) -> None:
    with _clients_lock:
        _clients.pop(connection_id, None)
    with _access_lock:
        _access_cache.pop(f"oauth:{connection_id}", None)


# ====================================================================== sign in with Google
def auth_url(state: str, code_challenge: str) -> str:
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.google_redirect_url,
        "response_type": "code",
        "scope": " ".join(OAUTH_SCOPES),
        "access_type": "offline",  # we need a refresh token: writes happen while the customer is away
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code(code: str, code_verifier: str) -> dict:
    """Returns {"refresh_token", "access_token", "expires_in", "scope", "sub", "email"}."""
    with _http() as http:
        try:
            resp = http.post(
                TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                    "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    "code": code,
                    "code_verifier": code_verifier,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.google_redirect_url,
                },
            )
        except httpx.HTTPError as exc:
            raise SheetsError("Couldn't reach Google sign-in.", temporary=True) from exc
    if resp.status_code != 200:
        raise SheetsError("Google sign-in didn't complete. Please try again.")
    data = resp.json()
    # The id_token came straight from Google's token endpoint over HTTPS, so its contents can be trusted
    # without checking the signature (Google's documented guidance for this exact case).
    claims = _jwt_claims(data.get("id_token", ""))
    if claims.get("aud") not in (settings.GOOGLE_OAUTH_CLIENT_ID, None):
        raise SheetsError("Google sign-in returned a token for a different app.")
    return {
        "refresh_token": data.get("refresh_token"),
        "access_token": data.get("access_token"),
        "expires_in": int(data.get("expires_in", 3600)),
        "scope": data.get("scope", ""),
        "sub": str(claims.get("sub", "")),
        "email": str(claims.get("email", "")),
    }


def revoke(refresh_token: str) -> None:
    try:
        with _http(10) as http:
            http.post(REVOKE_URL, data={"token": refresh_token})
    except httpx.HTTPError:
        pass


def _jwt_claims(token: str) -> dict:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))
    except (IndexError, ValueError):
        return {}
