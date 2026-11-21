"""Very small, safe template language: {{ variable_name }}.

- In HTML bodies every value is HTML-escaped, so visitors can't inject markup or scripts.
- Missing variables become an empty string (never the raw {{tag}}).
"""

import html
import re

_VAR = re.compile(r"\{\{\s*([a-zA-Z0-9_.\-]+)\s*\}\}")


def extract_variables(*parts: str) -> list[str]:
    seen: list[str] = []
    for part in parts:
        for name in _VAR.findall(part or ""):
            if name not in seen:
                seen.append(name)
    return seen


def _value(variables: dict, name: str) -> str:
    value = variables.get(name, "")
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(str(v) for v in value)
    return str(value)


def render(template: str, variables: dict, *, escape_html: bool) -> str:
    def repl(match: re.Match) -> str:
        value = _value(variables, match.group(1))
        if escape_html:
            return html.escape(value).replace("\n", "<br>")
        return value

    return _VAR.sub(repl, template or "")


def render_header(template: str, variables: dict) -> str:
    """Subjects must stay on one line (prevents email header injection)."""
    return " ".join(render(template, variables, escape_html=False).split())[:300]


def html_to_text(markup: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?</\1>", "", markup or "")
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</h[1-6]>|</li>|</tr>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def fields_table_html(fields: dict) -> str:
    """Used when a form is sent without a body: lists every submitted field nicely."""
    rows = "".join(
        f'<tr><td style="padding:6px 12px;font-weight:600;color:#334155;vertical-align:top">{html.escape(str(k))}</td>'
        f'<td style="padding:6px 12px;color:#0f172a">{html.escape(str(v)).replace(chr(10), "<br>")}</td></tr>'
        for k, v in fields.items()
    )
    return f'<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">{rows}</table>'


def fields_table_text(fields: dict) -> str:
    return "\n".join(f"{k}: {v}" for k, v in fields.items())
