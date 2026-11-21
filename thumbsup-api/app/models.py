"""Database tables.

Security rule used everywhere: every row that belongs to a customer carries a
`user_id`, and every dashboard query filters by the logged-in user's id.
"""

import secrets
from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(12)}"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("usr"))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    company: Mapped[str] = mapped_column(String(160), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(String(30), default="free")  # billing comes later
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # Bumped on logout / password reset: every older login token stops working
    session_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("key"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(10))  # "secret" | "public"
    prefix: Mapped[str] = mapped_column(String(24))  # first characters, safe to display
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # sha256 of the full key
    # Public keys are designed to live in website code, so they can be shown again.
    # Secret keys are NEVER stored in plain text — they are shown once at creation.
    public_value: Mapped[str | None] = mapped_column(String(80), nullable=True)
    allowed_origins: Mapped[list] = mapped_column(JSON, default=list)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("tpl"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    subject: Mapped[str] = mapped_column(String(300))
    html: Mapped[str] = mapped_column(Text, default="")
    text: Mapped[str] = mapped_column(Text, default="")
    # Where website-form emails go. Public keys can ONLY send to these addresses,
    # so a copied public key can never be used to spam strangers.
    to_emails: Mapped[list] = mapped_column(JSON, default=list)
    from_name: Mapped[str] = mapped_column(String(120), default="")
    from_email: Mapped[str] = mapped_column(String(320), default="")  # must be on a verified domain
    allow_public: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_reply: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_reply_subject: Mapped[str] = mapped_column(String(300), default="")
    auto_reply_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class EmailMessage(Base):
    __tablename__ = "email_messages"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_user_idempotency"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("em"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    api_key_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    template_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    source: Mapped[str] = mapped_column(String(20))  # "api" | "form" | "dashboard" | "auto_reply"
    # queued -> sending -> sent -> delivered | bounced | complained ; or failed
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    from_email: Mapped[str] = mapped_column(String(320))
    from_name: Mapped[str] = mapped_column(String(120), default="")
    to: Mapped[list] = mapped_column(JSON, default=list)
    cc: Mapped[list] = mapped_column(JSON, default=list)
    bcc: Mapped[list] = mapped_column(JSON, default=list)
    reply_to: Mapped[str | None] = mapped_column(String(320), nullable=True)
    subject: Mapped[str] = mapped_column(String(300))
    html: Mapped[str] = mapped_column(Text, default="")
    text: Mapped[str] = mapped_column(Text, default="")
    variables: Mapped[dict] = mapped_column(JSON, default=dict)  # form fields / template data
    attachments: Mapped[list] = mapped_column(JSON, default=list)  # metadata only, never file bytes
    tags: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    suppressed: Mapped[list] = mapped_column(JSON, default=list)  # recipients skipped (bounced/complained before)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    origin: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthCode(Base):
    """6-digit codes for email verification and password reset (stored hashed)."""

    __tablename__ = "auth_codes"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("code"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))  # "verify" | "reset"
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Suppression(Base):
    """Addresses we must not email again for this account (hard bounce, spam complaint, manual)."""

    __tablename__ = "suppressions"
    __table_args__ = (UniqueConstraint("user_id", "email", name="uq_user_suppression"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("sup"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    reason: Mapped[str] = mapped_column(String(20))  # "bounce" | "complaint" | "manual"
    detail: Mapped[str] = mapped_column(String(500), default="")
    message_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Domain(Base):
    """A customer's own sending domain, verified with DKIM DNS records."""

    __tablename__ = "domains"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("dom"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(253), unique=True, index=True)  # one owner per domain
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | verified | failed
    records: Mapped[list] = mapped_column(JSON, default=list)  # DNS records the customer must add
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StoredFile(Base):
    """Large uploads delivered as a secure, expiring download link instead of an attachment."""

    __tablename__ = "stored_files"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("file"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    path: Mapped[str] = mapped_column(String(500))
    download_token: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    downloads: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("wh"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    secret: Mapped[str] = mapped_column(String(80))  # used to sign every delivery (HMAC-SHA256)
    events: Mapped[list] = mapped_column(JSON, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("whd"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint_id: Mapped[str] = mapped_column(ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), index=True)
    event: Mapped[str] = mapped_column(String(40))
    message_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    response_snippet: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ======================================================================
# Drive Assets: files in a customer's Google Drive folder, served by name
# ======================================================================
class AssetProject(Base):
    __tablename__ = "asset_projects"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("ast"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True)  # part of every public URL
    # Not unique: an unverified claim must not block the real owner. Only ONE project per folder can be verified.
    folder_id: Mapped[str] = mapped_column(String(120), index=True)
    folder_name: Mapped[str] = mapped_column(String(255), default="")
    folder_ids: Mapped[list] = mapped_column(JSON, default=list)  # root + every subfolder (for change routing)
    # syncing | needs_verification | active | no_access | error
    status: Mapped[str] = mapped_column(String(20), default="syncing", index=True)
    # Set once the folder contained this account's verification file (proves edit access to the folder).
    # Nothing is served publicly before that.
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_count: Mapped[int] = mapped_column(Integer, default=0)
    total_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    sync_requested: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sync_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AssetFile(Base):
    __tablename__ = "asset_files"
    __table_args__ = (UniqueConstraint("project_id", "drive_file_id", name="uq_project_drive_file"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("af"))
    project_id: Mapped[str] = mapped_column(ForeignKey("asset_projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    drive_file_id: Mapped[str] = mapped_column(String(120))
    path: Mapped[str] = mapped_column(String(1000))  # e.g. "images/Hero.jpg" (as named in Drive)
    path_key: Mapped[str] = mapped_column(String(1000), index=True)  # lower-case lookup key
    mime_type: Mapped[str] = mapped_column(String(160))
    size: Mapped[int] = mapped_column(BigInteger, default=0)
    drive_version: Mapped[str] = mapped_column(String(80), default="")  # changes on every new upload/edit
    modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    export_format: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Google Docs: "pdf", ...
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    etag: Mapped[str] = mapped_column(String(80), default="")
    # active | removed (still served during the grace time) | too_large | blocked | error
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AssetEvent(Base):
    """Activity feed: added / updated / removed / renamed / conflict / access_lost / error."""

    __tablename__ = "asset_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("aev"))
    project_id: Mapped[str] = mapped_column(ForeignKey("asset_projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    path: Mapped[str] = mapped_column(String(1000), default="")
    message: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class AssetUsage(Base):
    __tablename__ = "asset_usage"
    __table_args__ = (UniqueConstraint("project_id", "day", name="uq_asset_usage_day"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("aus"))
    project_id: Mapped[str] = mapped_column(ForeignKey("asset_projects.id", ondelete="CASCADE"), index=True)
    day: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    hits: Mapped[int] = mapped_column(Integer, default=0)
    bytes_served: Mapped[int] = mapped_column(BigInteger, default=0)


class SystemState(Base):
    """Small key/value store (Google change-feed position, notification channel, ...)."""

    __tablename__ = "system_state"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# ======================================================================
# Sheets: Google Sheets used as a database
#   SheetConnection  a customer's Google account (Sign in with Google)
#   SheetDatabase    one spreadsheet
#   SheetTable       one tab; its columns are kept in the sheet's header row
#   SheetRow         our fast copy of each row (reads never wait for Google)
#   SheetOp          queued writes, sent to Google in batches
# ======================================================================
class SheetConnection(Base):
    __tablename__ = "sheet_connections"
    __table_args__ = (UniqueConstraint("user_id", "google_sub", name="uq_user_google_account"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("gac"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    google_sub: Mapped[str] = mapped_column(String(64))  # Google's permanent account id
    google_email: Mapped[str] = mapped_column(String(320), default="")
    refresh_token_enc: Mapped[str] = mapped_column(Text)  # encrypted, never returned by the API
    scopes: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | revoked
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SheetDatabase(Base):
    __tablename__ = "sheet_databases"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("sdb"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # "oauth" = customer's own Google account | "robot" = sheet shared with our service account
    auth_mode: Mapped[str] = mapped_column(String(10))
    connection_id: Mapped[str | None] = mapped_column(
        ForeignKey("sheet_connections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    spreadsheet_id: Mapped[str] = mapped_column(String(120), index=True)  # not unique: see verified_at
    spreadsheet_title: Mapped[str] = mapped_column(String(255), default="")
    # active | needs_verification | no_access | error
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    # Proof that this account controls the sheet. Only ONE verified database per spreadsheet.
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    flush_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SheetTable(Base):
    __tablename__ = "sheet_tables"
    __table_args__ = (UniqueConstraint("database_id", "name_key", name="uq_database_table"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("tbl"))
    database_id: Mapped[str] = mapped_column(ForeignKey("sheet_databases.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(60))  # the tab title
    name_key: Mapped[str] = mapped_column(String(60))  # lower-case, for lookups
    sheet_gid: Mapped[int] = mapped_column(Integer)  # Google's numeric id for the tab (survives renames)
    # [{"name": "email", "type": "email", "required": true}]  (user columns only; id/created_at/updated_at are extra)
    columns: Mapped[list] = mapped_column(JSON, default=list)
    allow_public_insert: Mapped[bool] = mapped_column(Boolean, default=False)  # website forms may add rows
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SheetRow(Base):
    __tablename__ = "sheet_rows"
    __table_args__ = (UniqueConstraint("table_id", "row_id", name="uq_table_row"),)

    pk: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    table_id: Mapped[str] = mapped_column(ForeignKey("sheet_tables.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    row_id: Mapped[str] = mapped_column(String(40))  # value of the "id" column in the sheet
    position: Mapped[int] = mapped_column(Integer, default=0)  # order in the sheet
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String(40), default="")
    updated_at: Mapped[str] = mapped_column(String(40), default="")


class SheetOp(Base):
    __tablename__ = "sheet_ops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    database_id: Mapped[str] = mapped_column(ForeignKey("sheet_databases.id", ondelete="CASCADE"), index=True)
    table_id: Mapped[str] = mapped_column(ForeignKey("sheet_tables.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    op: Mapped[str] = mapped_column(String(10))  # insert | update | delete
    row_id: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)  # pending | done | failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SheetEvent(Base):
    """Activity: connected / migration / column_added / column_deleted / sync_error / access_lost ..."""

    __tablename__ = "sheet_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("sev"))
    database_id: Mapped[str] = mapped_column(ForeignKey("sheet_databases.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class SheetMigration(Base):
    """Schema code that was applied (SQL-style migrations, pasted HTML/JS, or dashboard edits)."""

    __tablename__ = "sheet_migrations"
    __table_args__ = (UniqueConstraint("database_id", "name", name="uq_database_migration"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("mig"))
    database_id: Mapped[str] = mapped_column(ForeignKey("sheet_databases.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(120))  # e.g. "001_create_contacts" (applied only once)
    source: Mapped[str] = mapped_column(String(20))  # sql | html | js | json | csv | dashboard | api
    changes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
