"""An in-memory Google (OAuth token endpoint + Sheets API v4) for tests.

It follows the real API's behaviour where it matters:
  - drive.file: an account can only open spreadsheets it created or was given (picked)
  - values come back with trailing empty cells/rows trimmed
  - RAW input: "=1+1" stays text
  - deleting every row below a frozen header is refused (like Google)
  - a tab name that doesn't exist -> 400 "Unable to parse range"
"""

import base64
import json
import re
import secrets
from urllib.parse import parse_qs, unquote

import httpx

CLIENT_ID = "test-client-id"


def _unsigned_jwt(claims: dict) -> str:
    b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()  # noqa: E731
    return f"{b({'alg': 'none'})}.{b(claims)}.sig"


def col_index(letters: str) -> int:
    n = 0
    for ch in letters.upper():
        n = n * 26 + (ord(ch) - 64)
    return n - 1


class FakeGoogle:
    def __init__(self):
        self.codes: dict[str, dict] = {}
        self.refresh: dict[str, dict] = {}  # refresh token -> account
        self.access: dict[str, str] = {"robot-token": "robot"}  # access token -> account
        self.sheets: dict[str, dict] = {}
        self.calls: list[tuple[str, str]] = []  # (kind, path)
        self.fail_next: list[int] = []  # HTTP statuses to return for the next Sheets calls
        self.revoked: list[str] = []
        self.robot = "robot"

    # ---------------------------------------------------------------- helpers for tests
    def issue_code(self, sub="g-123", email="ann@gmail.com", scope=None) -> str:
        code = "code-" + secrets.token_hex(6)
        self.codes[code] = {"sub": sub, "email": email,
                            "scope": scope or "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file"}
        return code

    def make_sheet(self, owner: str, title="Existing", tabs=None) -> str:
        sid = "s" + secrets.token_hex(14)
        self.sheets[sid] = {"title": title, "access": {owner}, "tabs": []}
        for i, (name, rows) in enumerate((tabs or {"Sheet1": []}).items()):
            self.sheets[sid]["tabs"].append({"gid": 1000 + i, "title": name, "rows": [list(r) for r in rows], "frozen": 0})
        return sid

    def grant(self, sid: str, account: str) -> None:
        self.sheets[sid]["access"].add(account)

    def tab(self, sid: str, title: str) -> dict:
        return next(t for t in self.sheets[sid]["tabs"] if t["title"] == title)

    def values(self, sid: str, title: str) -> list[list]:
        return _trim([list(r) for r in self.tab(sid, title)["rows"]])

    def count(self, kind: str) -> int:
        return sum(1 for k, _ in self.calls if k == kind)

    # ---------------------------------------------------------------- transport
    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)

    def handle(self, request: httpx.Request) -> httpx.Response:
        url = request.url
        if url.host == "oauth2.googleapis.com":
            return self._oauth(request)
        if url.host != "sheets.googleapis.com":
            return httpx.Response(404, json={"error": {"message": "unknown host"}})
        token = request.headers.get("authorization", "")[7:]
        account = self.access.get(token)
        if not account:
            return httpx.Response(401, json={"error": {"message": "Invalid Credentials"}})
        kind = "write" if request.method == "POST" else "read"
        self.calls.append((kind, url.path))
        if self.fail_next:
            status = self.fail_next.pop(0)
            return httpx.Response(status, json={"error": {"message": f"fake {status}"}})
        path = unquote(url.raw_path.decode().split("?")[0])
        body = json.loads(request.content) if request.content else {}
        try:
            return self._sheets(request.method, path, dict(url.params), body, account)
        except _Err as e:
            return httpx.Response(e.status, json={"error": {"message": e.message}})

    def _oauth(self, request: httpx.Request) -> httpx.Response:
        form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
        if request.url.path == "/revoke":
            self.revoked.append(form.get("token", ""))
            self.refresh.pop(form.get("token", ""), None)
            return httpx.Response(200, json={})
        if form.get("grant_type") == "authorization_code":
            info = self.codes.pop(form.get("code", ""), None)
            if not info or not form.get("code_verifier"):
                return httpx.Response(400, json={"error": "invalid_grant"})
            access, refresh = "at-" + secrets.token_hex(8), "rt-" + secrets.token_hex(8)
            self.access[access] = info["sub"]
            self.refresh[refresh] = {"sub": info["sub"]}
            return httpx.Response(200, json={
                "access_token": access, "refresh_token": refresh, "expires_in": 3599, "scope": info["scope"],
                "id_token": _unsigned_jwt({"sub": info["sub"], "email": info["email"], "aud": CLIENT_ID}),
            })
        if form.get("grant_type") == "refresh_token":
            acct = self.refresh.get(form.get("refresh_token", ""))
            if not acct:
                return httpx.Response(400, json={"error": "invalid_grant"})
            access = "at-" + secrets.token_hex(8)
            self.access[access] = acct["sub"]
            return httpx.Response(200, json={"access_token": access, "expires_in": 3599})
        return httpx.Response(400, json={"error": "unsupported_grant_type"})

    # ---------------------------------------------------------------- Sheets API
    def _sheet(self, sid: str, account: str) -> dict:
        s = self.sheets.get(sid)
        if s is None or account not in s["access"]:
            raise _Err(404, "Requested entity was not found.")
        return s

    def _tab_by_name(self, s: dict, name: str) -> dict:
        t = next((t for t in s["tabs"] if t["title"] == name), None)
        if t is None:
            raise _Err(400, f"Unable to parse range: {name}")
        return t

    def _tab_by_gid(self, s: dict, gid: int) -> dict:
        t = next((t for t in s["tabs"] if t["gid"] == gid), None)
        if t is None:
            raise _Err(400, f"No grid with id: {gid}")
        return t

    def _meta(self, sid: str, s: dict) -> dict:
        return {"spreadsheetId": sid, "properties": {"title": s["title"]}, "sheets": [
            {"properties": {"sheetId": t["gid"], "title": t["title"], "index": i,
                            "gridProperties": {"rowCount": max(1000, len(t["rows"])), "columnCount": 26, "frozenRowCount": t["frozen"]}}}
            for i, t in enumerate(s["tabs"])]}

    def _sheets(self, method: str, path: str, params: dict, body: dict, account: str) -> httpx.Response:
        if method == "POST" and path == "/v4/spreadsheets":
            sid = "s" + secrets.token_hex(14)
            tabs = [{"gid": 0, "title": sh["properties"].get("title", "Sheet1"), "rows": [], "frozen": 0}
                    for sh in body.get("sheets", [{"properties": {"title": "Sheet1"}}])]
            self.sheets[sid] = {"title": body["properties"]["title"], "access": {account}, "tabs": tabs}
            return httpx.Response(200, json=self._meta(sid, self.sheets[sid]))
        m = re.match(r"^/v4/spreadsheets/([^/:]+)(.*)$", path)
        if not m:
            raise _Err(404, "not found")
        sid, rest = m.groups()
        s = self._sheet(sid, account)
        if method == "GET" and rest == "":
            return httpx.Response(200, json=self._meta(sid, s))
        if method == "POST" and rest == ":batchUpdate":
            replies = [self._request(s, r) for r in body.get("requests", [])]
            return httpx.Response(200, json={"spreadsheetId": sid, "replies": replies})
        if method == "POST" and rest == "/values:batchUpdate":
            assert body.get("valueInputOption") == "RAW"
            for d in body["data"]:
                t, r0, c0 = self._a1_start(s, d["range"])
                self._write(t, r0, c0, d["values"])
            return httpx.Response(200, json={})
        vm = re.match(r"^/values/(.+?)(:append)?$", rest)
        if vm:
            a1, append = vm.groups()
            if append:
                assert params.get("valueInputOption") == "RAW"
                t, _, _ = self._a1_start(s, a1)
                last = len(_trim(t["rows"]))
                self._write(t, last, 0, body["values"])
                return httpx.Response(200, json={})
            t, rows = self._read(s, a1)
            return httpx.Response(200, json={"range": a1, "values": rows} if rows else {"range": a1})
        raise _Err(404, "not found")

    def _split(self, a1: str) -> tuple[str, str]:
        m = re.match(r"^'((?:[^']|'')*)'(?:!(.*))?$", a1)
        if m:
            return m.group(1).replace("''", "'"), m.group(2) or ""
        name, _, rng = a1.partition("!")
        return name, rng

    def _a1_start(self, s: dict, a1: str) -> tuple[dict, int, int]:
        name, rng = self._split(a1)
        t = self._tab_by_name(s, name)
        m = re.match(r"^([A-Z]+)(\d+)", rng or "A1")
        if not m:
            raise _Err(400, f"Unable to parse range: {a1}")
        return t, int(m.group(2)) - 1, col_index(m.group(1))

    def _read(self, s: dict, a1: str) -> tuple[dict, list]:
        name, rng = self._split(a1)
        t = self._tab_by_name(s, name)
        rows = _trim([list(r) for r in t["rows"]])
        if rng:
            m = re.match(r"^(\d+):(\d+)$", rng)
            if m:
                rows = rows[int(m.group(1)) - 1: int(m.group(2))]
            else:
                raise _Err(400, f"fake doesn't support range {rng}")
        return t, _trim(rows)

    def _write(self, t: dict, r0: int, c0: int, values: list[list]) -> None:
        for i, row in enumerate(values):
            while len(t["rows"]) <= r0 + i:
                t["rows"].append([])
            target = t["rows"][r0 + i]
            for j, v in enumerate(row):
                while len(target) <= c0 + j:
                    target.append("")
                target[c0 + j] = v

    def _request(self, s: dict, r: dict) -> dict:
        (kind, p), = r.items()
        if kind == "addSheet":
            props = p["properties"]
            if any(t["title"].lower() == props["title"].lower() for t in s["tabs"]):
                raise _Err(400, f"A sheet with the name \"{props['title']}\" already exists.")
            gid = props.get("sheetId", 5000 + len(s["tabs"]))
            s["tabs"].append({"gid": gid, "title": props["title"], "rows": [],
                              "frozen": props.get("gridProperties", {}).get("frozenRowCount", 0)})
            return {"addSheet": {"properties": {"sheetId": gid, "title": props["title"]}}}
        if kind == "deleteSheet":
            t = self._tab_by_gid(s, p["sheetId"])
            if len(s["tabs"]) == 1:
                raise _Err(400, "You can't remove all the sheets in a document.")
            s["tabs"].remove(t)
            return {}
        if kind == "updateSheetProperties":
            t = self._tab_by_gid(s, p["properties"]["sheetId"])
            new = p["properties"]["title"]
            if any(x is not t and x["title"].lower() == new.lower() for x in s["tabs"]):
                raise _Err(400, f"A sheet with the name \"{new}\" already exists.")
            t["title"] = new
            return {}
        if kind == "updateCells":
            if "start" in p:
                t = self._tab_by_gid(s, p["start"]["sheetId"])
                vals = [[c["userEnteredValue"].get("stringValue", "") for c in row["values"]] for row in p["rows"]]
                self._write(t, p["start"].get("rowIndex", 0), p["start"].get("columnIndex", 0), vals)
            else:  # clear a range
                rg = p["range"]
                t = self._tab_by_gid(s, rg["sheetId"])
                for i in range(rg["startRowIndex"], min(rg["endRowIndex"], len(t["rows"]))):
                    t["rows"][i] = []
            return {}
        if kind == "insertDimension":
            rg = p["range"]
            t = self._tab_by_gid(s, rg["sheetId"])
            n = rg["endIndex"] - rg["startIndex"]
            if rg["dimension"] == "COLUMNS":
                for row in t["rows"]:
                    if len(row) > rg["startIndex"]:
                        row[rg["startIndex"]:rg["startIndex"]] = [""] * n
            else:
                t["rows"][rg["startIndex"]:rg["startIndex"]] = [[] for _ in range(n)]
            return {}
        if kind == "deleteDimension":
            rg = p["range"]
            t = self._tab_by_gid(s, rg["sheetId"])
            if rg["dimension"] == "COLUMNS":
                for row in t["rows"]:
                    del row[rg["startIndex"]:rg["endIndex"]]
            else:
                remaining = [r for i, r in enumerate(t["rows"]) if not (rg["startIndex"] <= i < rg["endIndex"])]
                if t["frozen"] and len(remaining) <= t["frozen"] and len(t["rows"]) > t["frozen"]:
                    raise _Err(400, "Sorry, it is not possible to delete all non-frozen rows.")
                t["rows"] = remaining
            return {}
        if kind == "moveDimension":
            src = p["source"]
            t = self._tab_by_gid(s, src["sheetId"])
            assert src["dimension"] == "COLUMNS"
            i, dest = src["startIndex"], p["destinationIndex"]
            width = max([len(r) for r in t["rows"]] + [dest + 1, i + 1])
            for row in t["rows"]:
                row.extend([""] * (width - len(row)))
                v = row.pop(i)
                row.insert(dest - 1 if dest > i else dest, v)
            return {}
        raise _Err(400, f"fake doesn't support {kind}")


class _Err(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


def _trim(rows: list[list]) -> list[list]:
    out = []
    for r in rows:
        r = list(r)
        while r and r[-1] in ("", None):
            r.pop()
        out.append(r)
    while out and not out[-1]:
        out.pop()
    return out
