"""Reading browser forms (multipart/form-data, urlencoded or JSON) safely."""

import json

from fastapi import Request
from starlette.datastructures import UploadFile

from app.config import settings
from app.deps import ApiError
from app.services.files import MB, Attachment, validate_attachment

MAX_FIELDS = 60
MAX_FILES = 10
MAX_FIELD_CHARS = 10_000


async def read_form(request: Request, max_files: int = MAX_FILES) -> tuple[dict, list[Attachment]]:
    ctype = request.headers.get("content-type", "")
    fields: dict = {}
    files: list[Attachment] = []

    if ctype.startswith("application/json"):
        try:
            data = await request.json()
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ApiError(400, "invalid_json", "The request body is not valid JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "invalid_json", "Send a JSON object.")
        fields = data
    elif ctype.startswith("multipart/form-data") or ctype.startswith("application/x-www-form-urlencoded"):
        try:
            form = await request.form(
                max_files=max_files, max_fields=MAX_FIELDS, max_part_size=settings.MAX_FILE_MB * MB
            )
        except Exception as exc:  # starlette raises on limits / broken bodies
            raise ApiError(400, "invalid_form", f"Could not read the form: {exc}")
        for name, value in form.multi_items():
            if isinstance(value, UploadFile):
                if not value.filename:
                    continue  # empty <input type=file>
                data = await value.read()
                if not data:
                    continue
                files.append(validate_attachment(value.filename, value.content_type, data))
            else:
                if name in fields:  # checkboxes with the same name → list
                    prev = fields[name]
                    fields[name] = (prev if isinstance(prev, list) else [prev]) + [value]
                else:
                    fields[name] = value
    else:
        raise ApiError(415, "unsupported_content_type", "Send multipart/form-data, a URL-encoded form, or JSON.")

    if len(fields) > MAX_FIELDS:
        raise ApiError(422, "too_many_fields", f"A form can have at most {MAX_FIELDS} fields.")
    for k, v in fields.items():
        if isinstance(v, str) and len(v) > MAX_FIELD_CHARS:
            raise ApiError(422, "field_too_long", f"The field '{k}' is too long (max {MAX_FIELD_CHARS} characters).")
    return fields, files
