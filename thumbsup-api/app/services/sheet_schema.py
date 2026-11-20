"""Find table columns in code, and turn schema code into a list of changes.

Supported input (detected automatically):
  sql   CREATE TABLE / ALTER TABLE ... ADD | DROP | RENAME COLUMN / RENAME TO / DROP TABLE
  html  <form> fields (input, select, textarea), also inside JSX/Vue/Svelte templates
  js    FormData.append("x"), JSON.stringify({ ... }), useState({ ... }), plus any HTML inside
  json  an object, an array of objects, or {"table": [ {...} ]}
  csv   a header line

The code is only READ as text. Nothing the customer pastes is ever executed.
"""

import csv
import io
import json
import re
from html.parser import HTMLParser

TYPES = ("text", "number", "boolean", "email", "url", "phone", "date", "datetime")
SYSTEM_COLUMNS = ("id", "created_at", "updated_at")
MAX_SOURCE_CHARS = 200_000

COLUMN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_\- .]{0,62}$")
TABLE_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_\- ]{0,49}$")


class SchemaError(ValueError):
    pass


# ====================================================================== names
def clean_column_name(raw: str) -> str:
    name = (raw or "").strip()
    name = re.sub(r"\[\]$", "", name)  # items[] -> items
    name = re.sub(r"\[([^\]]+)\]", r"_\1", name)  # address[city] -> address_city
    return name.strip()


def check_column_name(name: str) -> str:
    name = (name or "").strip()
    if not COLUMN_RE.match(name):
        raise SchemaError(
            f"'{name[:70]}' isn't a valid column name. Use letters, numbers, _ - . or spaces, "
            "start with a letter, max 63 characters."
        )
    if name.lower() in SYSTEM_COLUMNS:
        raise SchemaError(f"'{name}' is added automatically by ThumbsUp. Pick another name.")
    return name


def check_table_name(name: str) -> str:
    name = (name or "").strip()
    if not TABLE_RE.match(name):
        raise SchemaError(f"'{name[:60]}' isn't a valid table name. Use letters, numbers, _ - or spaces (max 50).")
    return name


def check_type(t: str) -> str:
    t = (t or "text").strip().lower()
    if t not in TYPES:
        raise SchemaError(f"Unknown column type '{t}'. Use one of: {', '.join(TYPES)}.")
    return t


def column(name: str, type_: str = "text", required: bool = False) -> dict:
    return {"name": name, "type": type_, "required": bool(required)}


# ====================================================================== detection
def detect_kind(code: str) -> str:
    s = _strip_sql_comments(code).strip()
    if re.match(r"(?is)^(create|alter|drop)\s+table\b", s):
        return "sql"
    if s[:1] in "[{":
        try:
            json.loads(s)
            return "json"
        except ValueError:
            pass
    if re.search(r"(?i)<\s*(form|input|select|textarea)\b", code):
        return "js" if re.search(r"(?m)\b(function|const|let|var|import|export|return)\b", code) else "html"
    first = s.splitlines()[0] if s else ""
    if "," in first and not re.search(r"[{}();=<>]", first):
        return "csv"
    return "js"


def parse(code: str, kind: str = "auto", default_table: str = "") -> dict:
    """Returns {"kind", "changes": [...], "warnings": [...]}. Changes still have to be planned against the
    current tables (see plan())."""
    if len(code or "") > MAX_SOURCE_CHARS:
        raise SchemaError(f"That's too much code at once (max {MAX_SOURCE_CHARS // 1000}k characters).")
    if not (code or "").strip():
        raise SchemaError("Paste some code first.")
    kind = detect_kind(code) if kind in ("", "auto") else kind
    warnings: list[str] = []
    if kind == "sql":
        changes = parse_sql(code, warnings)
    elif kind == "json":
        changes = _tables_to_changes(parse_json(code, default_table or "data", warnings))
    elif kind == "csv":
        changes = _tables_to_changes(parse_csv(code, default_table or "data", warnings))
    elif kind in ("html", "js"):
        tables = parse_html(code, default_table or "submissions", warnings)
        if kind == "js":
            tables = _merge_tables(tables, parse_js(code, default_table or "submissions", warnings))
        changes = _tables_to_changes(tables)
    else:
        raise SchemaError("kind must be auto, sql, html, js, json or csv.")
    if not changes:
        raise SchemaError("No columns found. Make sure form fields have a name=\"...\" attribute, or paste SQL.")
    return {"kind": kind, "changes": changes, "warnings": warnings}


def _tables_to_changes(tables: dict[str, list[dict]]) -> list[dict]:
    return [{"op": "create_table", "table": t, "columns": cols} for t, cols in tables.items() if cols]


def _merge_tables(a: dict, b: dict) -> dict:
    out = {k: list(v) for k, v in a.items()}
    for t, cols in b.items():
        target = out.setdefault(t, [])
        if t not in a and len(out) > 1 and len(a) == 1:
            target = out[next(iter(a))]  # loose JS fields belong to the single form on the page
        names = {c["name"].lower() for c in target}
        for c in cols:
            if c["name"].lower() not in names:
                target.append(c)
                names.add(c["name"].lower())
    return {k: v for k, v in out.items() if v}


def _add(cols: list[dict], seen: set, name: str, type_: str, required: bool, warnings: list[str]) -> None:
    name = clean_column_name(name)
    if not name or name.startswith("_"):  # _gotcha honeypots, _next, CSRF tokens ...
        return
    key = name.lower()
    if key in SYSTEM_COLUMNS:
        warnings.append(f"Skipped '{name}': ThumbsUp adds it automatically.")
        return
    if key in seen:
        return
    if not COLUMN_RE.match(name):
        warnings.append(f"Skipped '{name[:60]}': not a valid column name.")
        return
    seen.add(key)
    cols.append(column(name, type_, required))


# ---------------------------------------------------------------- HTML
INPUT_TYPES = {
    "email": "email", "number": "number", "range": "number", "checkbox": "boolean", "date": "date",
    "datetime-local": "datetime", "datetime": "datetime", "url": "url", "tel": "phone",
}
SKIP_INPUTS = {"submit", "button", "reset", "image", "file", "password"}
SKIP_NAMES = re.compile(r"(?i)^(csrf|csrfmiddlewaretoken|authenticity_token|g-recaptcha-response|cf-turnstile-response|h-captcha-response|public_key|template_id|access_key)$")


class _FormParser(HTMLParser):
    def __init__(self, default_table: str):
        super().__init__(convert_charrefs=True)
        self.default_table = default_table
        self.tables: dict[str, list[dict]] = {}
        self.seen: dict[str, set] = {}
        self.current: str | None = None
        self.form_count = 0
        self.warnings: list[str] = []
        self.checkbox_names: dict[str, int] = {}
        self.radio: set = set()

    def _table(self) -> str:
        return self.current or self.default_table

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        tag = tag.lower()
        if tag == "form":
            self.form_count += 1
            name = a.get("data-table") or a.get("name") or a.get("id") or ""
            name = re.sub(r"[^A-Za-z0-9_\- ]", "", name).strip()[:50]
            self.current = name or (self.default_table if self.form_count == 1 else f"{self.default_table}_{self.form_count}")
            self.tables.setdefault(self.current, [])
            return
        if tag not in ("input", "select", "textarea"):
            return
        # JSX: name={"email"} -> the parser keeps braces; strip them
        name = re.sub(r"^\{?['\"`]?|['\"`]?\}?$", "", a.get("name", "")).strip()
        if not name or SKIP_NAMES.match(name):
            return
        itype = a.get("type", "text").lower() if tag == "input" else ("text" if tag == "textarea" else "select")
        if itype in SKIP_INPUTS:
            if itype in ("file", "password"):
                self.warnings.append(f"Skipped '{name}': {itype} fields aren't stored in sheets.")
            return
        if itype == "hidden" and ("honeypot" in name.lower() or name.startswith("_")):
            return
        table = self._table()
        cols = self.tables.setdefault(table, [])
        seen = self.seen.setdefault(table, set())
        type_ = INPUT_TYPES.get(itype, "text")
        if itype == "checkbox":
            key = (table, clean_column_name(name).lower())
            self.checkbox_names[key] = self.checkbox_names.get(key, 0) + 1
            if self.checkbox_names[key] > 1:  # several checkboxes with one name = a list of choices
                for c in cols:
                    if c["name"].lower() == key[1]:
                        c["type"] = "text"
                return
        required = "required" in a and a.get("required", "") not in ("false", "{false}")
        _add(cols, seen, name, type_, required, self.warnings)

    def handle_endtag(self, tag):
        if tag.lower() == "form":
            self.current = None


def parse_html(code: str, default_table: str, warnings: list[str]) -> dict[str, list[dict]]:
    p = _FormParser(check_table_name(default_table))
    try:
        p.feed(code)
        p.close()
    except Exception:  # noqa: BLE001 - broken markup: keep what we found
        warnings.append("Some of the HTML couldn't be read; check the columns below.")
    warnings.extend(p.warnings)
    return {k: v for k, v in p.tables.items() if v}


# ---------------------------------------------------------------- JavaScript
def parse_js(code: str, default_table: str, warnings: list[str]) -> dict[str, list[dict]]:
    cols: list[dict] = []
    seen: set = set()
    for m in re.finditer(r"\.(?:append|set)\(\s*['\"`]([^'\"`]{1,80})['\"`]", code):
        _add(cols, seen, m.group(1), "text", False, warnings)
    for m in re.finditer(r"(?:JSON\.stringify|useState|reactive|ref|body\s*:|data\s*:|payload\s*=|values\s*=)\s*\(?\s*(\{)", code):
        obj = _balanced(code, m.start(1))
        if obj:
            for key, value in _object_keys(obj):
                _add(cols, seen, key, _infer_js_type(key, value), False, warnings)
    return {default_table: cols} if cols else {}


def _balanced(code: str, start: int) -> str | None:
    depth = 0
    quote = None
    for i in range(start, min(len(code), start + 20000)):
        ch = code[i]
        if quote:
            if ch == "\\":
                continue
            if ch == quote:
                quote = None
            continue
        if ch in "'\"`":
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return code[start + 1 : i]
    return None


def _object_keys(body: str) -> list[tuple[str, str]]:
    """Top-level keys of a JS object literal body, with the start of each value."""
    out = []
    depth = 0
    quote = None
    token_start = 0
    parts = []
    for i, ch in enumerate(body):
        if quote:
            if ch == quote and body[i - 1] != "\\":
                quote = None
            continue
        if ch in "'\"`":
            quote = ch
        elif ch in "{[(":
            depth += 1
        elif ch in "}])":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(body[token_start:i])
            token_start = i + 1
    parts.append(body[token_start:])
    for part in parts:
        part = part.strip()
        if not part or part.startswith("..."):
            continue
        m = re.match(r"""^(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$-]*))\s*(?::\s*(.*))?$""", part, re.S)
        if m:
            out.append((m.group(1) or m.group(2), (m.group(3) or "").strip()))
    return out


def _infer_js_type(key: str, value: str) -> str:
    v = value.strip()
    if v in ("true", "false"):
        return "boolean"
    if re.match(r"^-?\d+(\.\d+)?$", v):
        return "number"
    return _infer_from_name(key)


def _infer_from_name(key: str) -> str:
    k = key.lower()
    if "email" in k:
        return "email"
    if k in ("phone", "mobile", "tel", "telephone") or k.endswith("_phone"):
        return "phone"
    if k in ("url", "website", "link") or k.endswith("_url"):
        return "url"
    return "text"


# ---------------------------------------------------------------- JSON / CSV
def _infer_value(key: str, v) -> str:
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            return "date"
        if re.match(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}", v):
            return "datetime"
        if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            return "email"
        if re.match(r"^https?://", v):
            return "url"
    return _infer_from_name(key)


def _cols_from_objects(objs: list, warnings: list[str]) -> list[dict]:
    cols: list[dict] = []
    seen: set = set()
    for o in objs[:200]:
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, (dict, list)):
                    warnings.append(f"'{k}' holds a nested object; it will be stored as text.")
                    _add(cols, seen, str(k), "text", False, warnings)
                else:
                    _add(cols, seen, str(k), _infer_value(str(k), v), False, warnings)
    return cols


def parse_json(code: str, default_table: str, warnings: list[str]) -> dict[str, list[dict]]:
    try:
        data = json.loads(code)
    except ValueError as exc:
        raise SchemaError(f"That JSON isn't valid: {exc}") from exc
    if isinstance(data, dict) and data and all(isinstance(v, list) and v and isinstance(v[0], dict) for v in data.values()):
        return {check_table_name(str(t)): _cols_from_objects(rows, warnings) for t, rows in data.items()}
    if isinstance(data, dict):
        return {default_table: _cols_from_objects([data], warnings)}
    if isinstance(data, list):
        return {default_table: _cols_from_objects(data, warnings)}
    raise SchemaError("Paste a JSON object or a list of objects.")


def parse_csv(code: str, default_table: str, warnings: list[str]) -> dict[str, list[dict]]:
    reader = csv.reader(io.StringIO(code.strip()))
    try:
        header = next(reader)
        sample = next(reader, None)
    except (StopIteration, csv.Error) as exc:
        raise SchemaError("Couldn't read the CSV header line.") from exc
    cols: list[dict] = []
    seen: set = set()
    for i, h in enumerate(header):
        v = sample[i] if sample and i < len(sample) else None
        t = _infer_value(h, _number_or_str(v)) if v not in (None, "") else _infer_from_name(h)
        _add(cols, seen, h, t, False, warnings)
    return {default_table: cols}


def _number_or_str(v):
    try:
        return float(v) if re.match(r"^-?\d+(\.\d+)?$", v or "") else v
    except ValueError:
        return v


# ---------------------------------------------------------------- SQL
SQL_TYPES = [
    (r"^(var)?char|^text|^string|^uuid|^json|^enum|^citext|^clob", "text"),
    (r"^(tiny|small|medium|big)?int|^integer|^serial|^bigserial|^decimal|^numeric|^float|^double|^real|^money", "number"),
    (r"^bool", "boolean"),
    (r"^timestamp|^datetime", "datetime"),
    (r"^date$", "date"),
    (r"^time", "text"),
    (r"^email", "email"),
    (r"^url|^link", "url"),
    (r"^phone|^tel", "phone"),
]


def _sql_type(raw: str) -> str:
    t = (raw or "text").lower()
    for pat, mapped in SQL_TYPES:
        if re.match(pat, t):
            return mapped
    return "text"


def _strip_sql_comments(code: str) -> str:
    code = re.sub(r"/\*.*?\*/", " ", code or "", flags=re.S)
    return re.sub(r"--[^\n]*", " ", code)


def _ident(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] in "`\"[" and s[-1] in "`\"]":
        s = s[1:-1]
    return s.strip()


def _split_top(body: str) -> list[str]:
    out, depth, start = [], 0, 0
    for i, ch in enumerate(body):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "," and depth == 0:
            out.append(body[start:i])
            start = i + 1
    out.append(body[start:])
    return [p.strip() for p in out if p.strip()]


IDENT = r"(`[^`]+`|\"[^\"]+\"|\[[^\]]+\]|[A-Za-z_][\w\- .]*?)"


def parse_sql(code: str, warnings: list[str]) -> list[dict]:
    text = _strip_sql_comments(code)
    statements = [s.strip() for s in text.split(";") if s.strip()]
    changes: list[dict] = []
    for st in statements:
        st1 = " ".join(st.split())
        m = re.match(rf"(?is)^create\s+table\s+(?:if\s+not\s+exists\s+)?{IDENT}\s*\((.*)\)\s*$", st)
        if m:
            table = check_table_name(_ident(m.group(1)).split(".")[-1])
            cols: list[dict] = []
            seen: set = set()
            for part in _split_top(m.group(2)):
                if re.match(r"(?i)^(primary\s+key|foreign\s+key|unique|constraint|check|index|key)\b", part):
                    continue
                cm = re.match(rf"(?is)^{IDENT}\s+([A-Za-z]+)(.*)$", part) or re.match(rf"(?is)^{IDENT}\s*$", part)
                if not cm:
                    raise SchemaError(f"Couldn't read the column definition: {part[:80]}")
                name = _ident(cm.group(1))
                type_ = _sql_type(cm.group(2) if cm.lastindex and cm.lastindex >= 2 else "text")
                rest = cm.group(3) if cm.lastindex and cm.lastindex >= 3 else ""
                required = bool(re.search(r"(?i)\bnot\s+null\b|\brequired\b", rest or ""))
                if name.lower() in SYSTEM_COLUMNS:
                    continue  # our own id / timestamps cover these
                check_column_name(name)
                _add(cols, seen, name, type_, required, warnings)
            changes.append({"op": "create_table", "table": table, "columns": cols})
            continue
        m = re.match(rf"(?is)^alter\s+table\s+{IDENT}\s+(.*)$", st1)
        if m:
            table = check_table_name(_ident(m.group(1)).split(".")[-1])
            for action in _split_top(m.group(2)):
                changes.append(_alter_action(table, action))
            continue
        m = re.match(rf"(?is)^drop\s+table\s+(?:if\s+exists\s+)?{IDENT}\s*$", st1)
        if m:
            changes.append({"op": "drop_table", "table": check_table_name(_ident(m.group(1)))})
            continue
        raise SchemaError(f"Only CREATE TABLE, ALTER TABLE and DROP TABLE are supported. Couldn't read: {st1[:80]}")
    return changes


def _alter_action(table: str, action: str) -> dict:
    a = " ".join(action.split())
    m = re.match(rf"(?i)^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?{IDENT}(?:\s+([A-Za-z]+)(.*))?$", a)
    if m:
        name = check_column_name(_ident(m.group(1)))
        required = bool(re.search(r"(?i)\bnot\s+null\b|\brequired\b", m.group(3) or ""))
        return {"op": "add_column", "table": table, "column": column(name, _sql_type(m.group(2) or "text"), required)}
    m = re.match(rf"(?i)^drop\s+(?:column\s+)?(?:if\s+exists\s+)?{IDENT}$", a)
    if m:
        return {"op": "drop_column", "table": table, "column": _ident(m.group(1))}
    m = re.match(rf"(?i)^rename\s+(?:column\s+)?{IDENT}\s+to\s+{IDENT}$", a)
    if m and not re.match(r"(?i)^rename\s+to\b", a):
        return {"op": "rename_column", "table": table, "column": _ident(m.group(1)), "to": check_column_name(_ident(m.group(2)))}
    m = re.match(rf"(?i)^rename\s+to\s+{IDENT}$", a)
    if m:
        return {"op": "rename_table", "table": table, "to": check_table_name(_ident(m.group(1)))}
    m = re.match(rf"(?i)^(?:alter|modify)\s+(?:column\s+)?{IDENT}\s+(?:type\s+)?([A-Za-z]+)(.*)$", a)
    if m:
        required = bool(re.search(r"(?i)\bnot\s+null\b|\brequired\b", m.group(3) or ""))
        return {"op": "alter_column", "table": table, "column": _ident(m.group(1)), "type": _sql_type(m.group(2)), "required": required}
    raise SchemaError(f"Unsupported ALTER TABLE action: {a[:80]}")


# ====================================================================== planning
def plan(changes: list[dict], current: dict[str, list[dict]], max_tables: int, max_columns: int) -> list[dict]:
    """Check the changes against the current tables ({table_name: columns}) and return the
    final list of steps. CREATE TABLE on an existing table only ADDS the missing columns
    (pasting the same form twice is safe). Raises SchemaError when something can't be done."""
    state = {k.lower(): {"name": k, "columns": [dict(c) for c in v]} for k, v in current.items()}
    steps: list[dict] = []

    def table(name: str) -> dict:
        t = state.get(name.lower())
        if not t:
            raise SchemaError(f"Table '{name}' doesn't exist.")
        return t

    def col_index(t: dict, name: str) -> int:
        for i, c in enumerate(t["columns"]):
            if c["name"].lower() == name.lower():
                return i
        raise SchemaError(f"Column '{name}' doesn't exist in '{t['name']}'.")

    for ch in changes:
        op = ch["op"]
        if op == "create_table":
            name = check_table_name(ch["table"])
            cols = []
            for c in ch.get("columns", []):
                cols.append(column(check_column_name(c["name"]), check_type(c.get("type", "text")), c.get("required", False)))
            if name.lower() in state:
                t = state[name.lower()]
                have = {c["name"].lower() for c in t["columns"]}
                for c in cols:
                    if c["name"].lower() not in have:
                        if len(t["columns"]) >= max_columns:
                            raise SchemaError(f"'{t['name']}' would have more than {max_columns} columns.")
                        t["columns"].append(c)
                        have.add(c["name"].lower())
                        steps.append({"op": "add_column", "table": t["name"], "column": c})
                continue
            if len(state) >= max_tables:
                raise SchemaError(f"A sheet can have at most {max_tables} tables.")
            if len(cols) > max_columns:
                raise SchemaError(f"'{name}' would have more than {max_columns} columns.")
            _no_dupes(cols, name)
            state[name.lower()] = {"name": name, "columns": cols}
            steps.append({"op": "create_table", "table": name, "columns": cols})
        elif op == "add_column":
            t = table(ch["table"])
            c = ch["column"]
            c = column(check_column_name(c["name"]), check_type(c.get("type", "text")), c.get("required", False))
            if any(x["name"].lower() == c["name"].lower() for x in t["columns"]):
                continue  # already there: migrations can be re-run safely
            if len(t["columns"]) >= max_columns:
                raise SchemaError(f"'{t['name']}' would have more than {max_columns} columns.")
            pos = ch.get("position")
            if pos is None or not (0 <= int(pos) <= len(t["columns"])):
                pos = len(t["columns"])
            t["columns"].insert(int(pos), c)
            steps.append({"op": "add_column", "table": t["name"], "column": c, "position": int(pos)})
        elif op == "drop_column":
            t = table(ch["table"])
            if ch["column"].lower() in SYSTEM_COLUMNS:
                raise SchemaError(f"'{ch['column']}' is a ThumbsUp column and can't be removed.")
            i = col_index(t, ch["column"])
            steps.append({"op": "drop_column", "table": t["name"], "column": t["columns"][i]["name"]})
            t["columns"].pop(i)
        elif op == "rename_column":
            t = table(ch["table"])
            i = col_index(t, ch["column"])
            new = check_column_name(ch["to"])
            if any(j != i and c["name"].lower() == new.lower() for j, c in enumerate(t["columns"])):
                raise SchemaError(f"'{t['name']}' already has a column called '{new}'.")
            steps.append({"op": "rename_column", "table": t["name"], "column": t["columns"][i]["name"], "to": new})
            t["columns"][i]["name"] = new
        elif op == "alter_column":
            t = table(ch["table"])
            i = col_index(t, ch["column"])
            c = t["columns"][i]
            new_type = check_type(ch.get("type") or c["type"])
            new_req = bool(ch.get("required", c["required"]))
            if new_type != c["type"] or new_req != c["required"]:
                c["type"], c["required"] = new_type, new_req
                steps.append({"op": "alter_column", "table": t["name"], "column": c["name"], "type": new_type, "required": new_req})
        elif op == "move_column":
            t = table(ch["table"])
            i = col_index(t, ch["column"])
            to = max(0, min(int(ch["position"]), len(t["columns"]) - 1))
            if to != i:
                c = t["columns"].pop(i)
                t["columns"].insert(to, c)
                steps.append({"op": "move_column", "table": t["name"], "column": c["name"], "from": i, "position": to})
        elif op == "rename_table":
            t = table(ch["table"])
            new = check_table_name(ch["to"])
            if new.lower() != t["name"].lower() and new.lower() in state:
                raise SchemaError(f"There's already a table called '{new}'.")
            steps.append({"op": "rename_table", "table": t["name"], "to": new})
            del state[t["name"].lower()]
            t["name"] = new
            state[new.lower()] = t
        elif op == "drop_table":
            t = table(ch["table"])
            steps.append({"op": "drop_table", "table": t["name"]})
            del state[t["name"].lower()]
        else:
            raise SchemaError(f"Unknown change '{op}'.")
    return steps


def _no_dupes(cols: list[dict], table: str) -> None:
    seen = set()
    for c in cols:
        if c["name"].lower() in seen:
            raise SchemaError(f"'{table}' lists the column '{c['name']}' twice.")
        seen.add(c["name"].lower())


def describe(step: dict) -> str:
    op = step["op"]
    t = step.get("table", "")
    if op == "create_table":
        return f"Create table '{t}' with {len(step['columns'])} columns: " + ", ".join(c["name"] for c in step["columns"])
    if op == "add_column":
        return f"Add column '{step['column']['name']}' ({step['column']['type']}) to '{t}'"
    if op == "drop_column":
        return f"Delete column '{step['column']}' from '{t}' (its data is deleted; columns to the right move left)"
    if op == "rename_column":
        return f"Rename column '{step['column']}' to '{step['to']}' in '{t}'"
    if op == "alter_column":
        return f"Change column '{step['column']}' in '{t}' to {step['type']}{', required' if step['required'] else ''}"
    if op == "move_column":
        return f"Move column '{step['column']}' in '{t}' to position {step['position'] + 1}"
    if op == "rename_table":
        return f"Rename table '{t}' to '{step['to']}'"
    if op == "drop_table":
        return f"Delete table '{t}' and all its rows"
    return op
