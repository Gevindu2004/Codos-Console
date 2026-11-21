"""ThumbsUp Email — runtime settings (read from environment variables or `.env`).

ThumbsUp always delivers real email. The server refuses to start until a real
delivery provider (SMTP or Amazon SES) is configured, and in production it also
refuses to start with unsafe security settings.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigError(RuntimeError):
    pass


class Settings(BaseSettings):
    PROJECT_NAME: str = "ThumbsUp Email API"
    # "development" (your laptop) | "production" (live server). "test" is only used by the automated tests.
    ENVIRONMENT: str = "development"

    # Public URL of this API (used in large-file download links)
    PUBLIC_BASE_URL: str = "http://localhost:8001"

    # Database. Production must use PostgreSQL:
    #   postgresql+psycopg://user:password@host:5432/thumbsup
    DATABASE_URL: str = "sqlite:///./storage/thumbsup.db"

    # Dashboard login sessions
    JWT_SECRET: str = ""
    SESSION_HOURS: int = 24 * 7
    COOKIE_NAME: str = "tu_session"
    COOKIE_SECURE: bool = False  # must be true in production (HTTPS)

    # Frontends allowed to use the dashboard, comma separated
    DASHBOARD_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ---------------- Email delivery ----------------
    # "smtp" -> any SMTP server (Gmail/Google Workspace, Microsoft 365, Zoho, Brevo, Amazon SES SMTP, ...)
    # "ses"  -> Amazon SES API (custom domains, bounce tracking)
    # "acs"  -> Azure Communication Services Email (for Azure hosting; bounce tracking via Event Grid)
    EMAIL_PROVIDER: str = ""
    DEFAULT_FROM_EMAIL: str = ""
    DEFAULT_FROM_NAME: str = "ThumbsUp Email"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_SSL: bool = False  # true for port 465, otherwise STARTTLS

    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""  # optional: leave empty to use the server's IAM role
    AWS_SECRET_ACCESS_KEY: str = ""
    SES_CONFIGURATION_SET: str = ""  # SES configuration set that publishes events to SNS
    SES_EVENTS_TOKEN: str = ""  # secret part of the SNS → ThumbsUp events URL

    # Azure Communication Services Email ("acs"). Either a connection string, or (recommended on Azure)
    # the resource endpoint + the app's managed identity with the "Communication and Email Service Owner" role.
    ACS_CONNECTION_STRING: str = ""
    ACS_ENDPOINT: str = ""  # e.g. https://viacodos-email.communication.azure.com
    ACS_EVENTS_TOKEN: str = ""  # secret part of the Event Grid -> ThumbsUp delivery-report URL

    # ---------------- Delivery queue ----------------
    WORKER_ENABLED: bool = True  # background sender inside the API process
    WORKER_POLL_SECONDS: float = 2.0
    MAX_DELIVERY_ATTEMPTS: int = 6  # transient failures are retried with backoff

    # ---------------- Limits ----------------
    STORAGE_DIR: str = "./storage"
    MAX_RECIPIENTS: int = 50
    MAX_FILE_MB: int = 25
    MAX_INLINE_ATTACHMENTS_MB: int = 8  # above this, files are sent as secure download links
    DOWNLOAD_LINK_DAYS: int = 7
    PUBLIC_FORM_RATE_PER_MINUTE: int = 10
    SECRET_KEY_RATE_PER_MINUTE: int = 120
    LOGIN_RATE_PER_MINUTE: int = 10
    LOGIN_FAILURES_PER_ACCOUNT: int = 10  # per 15 minutes, from any number of IPs
    MAX_REQUEST_MB: int = 40  # largest request body accepted (protects memory)
    # Number of reverse proxies in front of the API (Nginx/Caddy/Cloudflare = 1). Used to find the real visitor IP.
    TRUSTED_PROXY_HOPS: int = 1
    CODE_TTL_MINUTES: int = 15

    # ---------------- Drive Assets (Google Drive -> website files) ----------------
    # A Google Cloud service account ("robot") that customers share their folders with.
    GOOGLE_SERVICE_ACCOUNT_FILE: str = ""  # path to the JSON key file
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""  # or the JSON itself (handy on hosting platforms)
    # Public address that serves the files, e.g. https://assets.viacodos.com (defaults to PUBLIC_BASE_URL)
    ASSETS_BASE_URL: str = ""
    # Where copies of Drive files are kept: "local" (disk) or "s3" (Amazon S3 / Cloudflare R2 / any S3-compatible)
    ASSET_STORAGE: str = "local"  # local | s3 | azure
    S3_BUCKET: str = ""
    S3_ENDPOINT_URL: str = ""  # Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com
    S3_REGION: str = "auto"
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    # ASSET_STORAGE=azure: Azure Blob Storage. Either a connection string, or (recommended on Azure) the
    # account URL + the app's managed identity with the "Storage Blob Data Contributor" role.
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_STORAGE_ACCOUNT_URL: str = ""  # e.g. https://viacodosassets.blob.core.windows.net
    AZURE_STORAGE_CONTAINER: str = "thumbsup-assets"
    ASSET_POLL_SECONDS: int = 120  # safety re-check of every folder (push notifications are instant)
    ASSET_MAX_FILE_MB: int = 300
    ASSET_MAX_FILES: int = 2000  # per project
    ASSET_DELETE_GRACE_MINUTES: int = 30  # keep serving a deleted file this long (time to upload its replacement)
    ASSET_CACHE_SECONDS: int = 60  # browser/CDN cache time; replacements show up within this time
    DRIVE_PUSH_TOKEN: str = ""  # secret for Google change notifications (auto-generated if empty)

    # ---------------- Sheets (Google Sheets as a database) ----------------
    # "Sign in with Google": an OAuth web client from Google Cloud (APIs & Services > Credentials).
    # Uses only the drive.file permission: we can touch ONLY the sheets the customer creates or picks with us.
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    # Must be listed in the OAuth client's "Authorized redirect URIs" (defaults to PUBLIC_BASE_URL + the path below)
    GOOGLE_OAUTH_REDIRECT_URL: str = ""
    # Optional: lets customers pick an EXISTING sheet with Google's file picker (API key + project NUMBER)
    GOOGLE_PICKER_API_KEY: str = ""
    GOOGLE_CLOUD_PROJECT_NUMBER: str = ""
    # Where the browser goes back to after Google sign-in (the Codos Console page). Defaults to <first DASHBOARD_ORIGINS>/console.
    DASHBOARD_URL: str = ""
    # Encrypts the customers' Google refresh tokens in the database (Azure: keep it in Key Vault).
    # Generate:  python -c "import secrets; print(secrets.token_urlsafe(48))"
    DATA_ENCRYPTION_KEY: str = ""
    SHEETS_ROBOT_ENABLED: bool = True  # also allow "share your sheet with our robot email" (uses the service account)
    SHEETS_CACHE_SECONDS: int = 30  # reads come from our copy; it is refreshed from Google at most this often
    SHEETS_WRITES_PER_MINUTE: int = 50  # per Google account (Google allows 60); extra writes wait in the queue
    SHEETS_READS_PER_MINUTE: int = 50
    SHEETS_MAX_ROWS_PER_TABLE: int = 50000
    SHEETS_MAX_TABLES: int = 50  # per spreadsheet
    SHEETS_MAX_COLUMNS: int = 100  # per table
    SHEETS_MAX_BATCH: int = 500  # rows per API request
    SHEETS_PUBLIC_RATE_PER_MINUTE: int = 20  # website form submissions per visitor IP

    # Webhooks to private/internal addresses (SSRF). Always blocked in production.
    ALLOW_PRIVATE_WEBHOOK_URLS: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ---------------------------------------------------------------- helpers
    @property
    def dashboard_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.DASHBOARD_ORIGINS.split(",") if o.strip()]

    @property
    def assets_base_url(self) -> str:
        return (self.ASSETS_BASE_URL or self.PUBLIC_BASE_URL).rstrip("/")

    @property
    def drive_configured(self) -> bool:
        return bool(self.GOOGLE_SERVICE_ACCOUNT_FILE or self.GOOGLE_SERVICE_ACCOUNT_JSON)

    @property
    def sheets_oauth_configured(self) -> bool:
        return bool(self.GOOGLE_OAUTH_CLIENT_ID and self.GOOGLE_OAUTH_CLIENT_SECRET)

    @property
    def sheets_robot_configured(self) -> bool:
        return self.SHEETS_ROBOT_ENABLED and self.drive_configured

    @property
    def google_redirect_url(self) -> str:
        return self.GOOGLE_OAUTH_REDIRECT_URL or f"{self.PUBLIC_BASE_URL.rstrip('/')}/dashboard/sheets/google/callback"

    @property
    def dashboard_url(self) -> str:
        if self.DASHBOARD_URL:
            return self.DASHBOARD_URL.rstrip("/")
        origin = self.dashboard_origins[0] if self.dashboard_origins else "http://localhost:3000"
        return f"{origin}/console"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT.lower() == "test"

    @property
    def private_webhooks_allowed(self) -> bool:
        return self.ALLOW_PRIVATE_WEBHOOK_URLS and not self.is_production

    def validate_for_startup(self) -> None:
        """Stop the server with a clear message instead of silently misbehaving."""
        problems: list[str] = []
        provider = self.EMAIL_PROVIDER.lower().strip()

        if provider == "log" and not self.is_test:
            problems.append("EMAIL_PROVIDER=log is only for automated tests. Use smtp or ses.")
        elif provider not in ("smtp", "ses", "acs", "log"):
            problems.append(
                "EMAIL_PROVIDER is not set. Set EMAIL_PROVIDER=acs (Azure Communication Services), "
                "ses (Amazon SES) or smtp (and the SMTP_* settings)."
            )
        if provider == "acs" and not (self.ACS_CONNECTION_STRING or self.ACS_ENDPOINT):
            problems.append("Set ACS_ENDPOINT (managed identity) or ACS_CONNECTION_STRING for EMAIL_PROVIDER=acs.")
        if provider == "smtp":
            for name in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD"):
                if not getattr(self, name):
                    problems.append(f"{name} is empty (needed for EMAIL_PROVIDER=smtp).")
        if provider in ("smtp", "ses", "acs") and "@" not in self.DEFAULT_FROM_EMAIL:
            problems.append("DEFAULT_FROM_EMAIL must be a real address your provider allows you to send from.")

        if len(self.JWT_SECRET) < 32 or self.JWT_SECRET.startswith("change-me"):
            problems.append(
                "JWT_SECRET must be a random string of at least 32 characters. "
                'Generate one: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )

        if self.is_production:
            if not self.COOKIE_SECURE:
                problems.append("COOKIE_SECURE must be true in production.")
            if not self.PUBLIC_BASE_URL.startswith("https://"):
                problems.append("PUBLIC_BASE_URL must start with https:// in production.")
            if self.DATABASE_URL.startswith("sqlite"):
                problems.append("Use PostgreSQL in production (DATABASE_URL=postgresql+psycopg://...).")
            if any(not o.startswith("https://") for o in self.dashboard_origins):
                problems.append("DASHBOARD_ORIGINS must only contain https:// addresses in production.")
            if provider == "ses" and not self.SES_EVENTS_TOKEN:
                problems.append("SES_EVENTS_TOKEN must be set so bounces and complaints are tracked.")
            if provider == "acs" and len(self.ACS_EVENTS_TOKEN) < 24:
                problems.append("ACS_EVENTS_TOKEN must be set (24+ random characters) so bounces are tracked (Azure Event Grid).")

        # Drive Assets is optional; when it's switched on it must be set up correctly.
        if self.drive_configured:
            from app.services.drive import load_service_account_info

            try:
                load_service_account_info()
            except Exception as exc:  # noqa: BLE001
                problems.append(f"Google service account: {exc}")
        if self.ASSET_STORAGE.lower() not in ("local", "s3", "azure"):
            problems.append("ASSET_STORAGE must be local, s3 or azure.")
        if self.ASSET_STORAGE.lower() == "azure" and not (self.AZURE_STORAGE_CONNECTION_STRING or self.AZURE_STORAGE_ACCOUNT_URL):
            problems.append("Set AZURE_STORAGE_ACCOUNT_URL (managed identity) or AZURE_STORAGE_CONNECTION_STRING for ASSET_STORAGE=azure.")
        if self.ASSET_STORAGE.lower() == "s3":
            for name in ("S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"):
                if not getattr(self, name):
                    problems.append(f"{name} is empty (needed for ASSET_STORAGE=s3).")
        if self.is_production and self.drive_configured and not self.assets_base_url.startswith("https://"):
            problems.append("ASSETS_BASE_URL must start with https:// in production.")

        # Sheets: Google sign-in is optional; when it's switched on it must be complete and safe.
        if bool(self.GOOGLE_OAUTH_CLIENT_ID) != bool(self.GOOGLE_OAUTH_CLIENT_SECRET):
            problems.append("Set both GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET (or neither).")
        if self.sheets_oauth_configured:
            if len(self.DATA_ENCRYPTION_KEY) < 32:
                problems.append(
                    "DATA_ENCRYPTION_KEY must be a random string of at least 32 characters (it protects customers' "
                    'Google tokens). Generate one: python -c "import secrets; print(secrets.token_urlsafe(48))"'
                )
            elif self.DATA_ENCRYPTION_KEY == self.JWT_SECRET:
                problems.append("DATA_ENCRYPTION_KEY must be different from JWT_SECRET.")
            if self.is_production and not self.google_redirect_url.startswith("https://"):
                problems.append("GOOGLE_OAUTH_REDIRECT_URL must start with https:// in production.")
            if self.is_production and not self.dashboard_url.startswith("https://"):
                problems.append("DASHBOARD_URL must start with https:// in production.")

        if problems:
            raise ConfigError(
                "ThumbsUp Email can't start. Fix these settings in thumbsup-api/.env:\n  - " + "\n  - ".join(problems)
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
