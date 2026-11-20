# ThumbsUp Email API

The **Thumbs Up API** service of Codos Console: a production email API for sending from
servers **and** websites. It's independent from Call Colleague and Sky Beak (its own
backend, database and accounts).

```
Codos-Console/
├── thumbsup-api/                 ← this backend (FastAPI, port 8001)
└── src/components/thumbs-up/     ← the dashboard UI (Thumbs Up API tab)
```

ThumbsUp **always sends real email**. It won't start until a real delivery provider is
configured, and it prints exactly which setting is missing.

## 1. Configure delivery

Copy `.env.example` to `.env` and fill in one provider.

**SMTP (quickest):** works with Gmail/Google Workspace, Microsoft 365, Zoho, Brevo, or SES SMTP.

```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@yourcompany.com
SMTP_PASSWORD=<app password>
DEFAULT_FROM_EMAIL=you@yourcompany.com
```

Gmail needs 2-Step Verification plus an App Password (https://myaccount.google.com/apppasswords).
Gmail allows roughly 500 emails a day, which is fine for testing and small use.

**Amazon SES (recommended for production):** high volume, customers can send from
their own verified domains, and bounces and spam complaints are tracked automatically.

```
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=thumbsup-events
SES_EVENTS_TOKEN=<random string>
DEFAULT_FROM_EMAIL=no-reply@yourcompany.com   # a verified SES identity
```

To set up SES events, create a configuration set with an SNS event destination (Delivery, Bounce,
Complaint). Then subscribe `https://<api>/v1/providers/ses/events/<SES_EVENTS_TOKEN>` to the topic
over HTTPS. ThumbsUp confirms the subscription by itself. Ask AWS to move SES out of the
"sandbox" so you can email any address.

## 2. Run on your laptop (Windows)

```powershell
.\thumbsup-api\run-dev.ps1
```

The first run creates `.venv`, installs packages, and creates `.env` with a random JWT secret.
Then add your SMTP settings to `thumbsup-api\.env` and run it again. Start the frontend with
`npm run dev` and open **Thumbs Up API** in the console.

API reference: http://localhost:8001/docs

## 3. Deploy to production

```bash
cd thumbsup-api
cp .env.example .env    # ENVIRONMENT=production, COOKIE_SECURE=true, https URLs, provider, JWT_SECRET
export POSTGRES_PASSWORD=<strong password>
docker compose up -d --build
```

Put an HTTPS reverse proxy (Caddy, Nginx, or a cloud load balancer) in front of port 8001. In
production the server refuses to start with unsafe settings: no HTTPS, SQLite, a weak JWT secret,
insecure cookies, and so on. Database migrations (Alembic) run automatically at startup. After
changing `app/models.py`, run `alembic revision --autogenerate -m "what changed"`.

## How delivery works

1. The API checks the request, saves the email to the database and its files to disk, then answers
   `202 {"id": "em_…", "status": "queued"}`.
2. A background worker sends it. Temporary problems (server down, rate limits) are **retried**
   after 1, 5, 15, 60, 180 and 360 minutes. Permanent problems fail with a clear reason.
3. Addresses that hard-bounce or mark you as spam go on the account's **suppression list** and
   are skipped from then on. This protects sender reputation.
4. Statuses: `queued → sending → sent → delivered`, or `bounced`, `complained` or `failed`. Each
   status change fires a signed webhook.
5. Nothing is lost on restart, and several API processes can run safely: each email is claimed
   atomically, so it is never sent twice.

## API

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/v1/emails` | Secret key | Send (raw or template, `from` on a verified domain, attachments, `Idempotency-Key`) |
| GET | `/v1/emails/{id}` | Secret key | Delivery status |
| POST | `/v1/forms/send` | Public key + allowed website | Website forms (multipart, files, honeypot, auto-reply) |
| GET | `/v1/files/{token}` | Link token | Download a large file sent as a link |
| POST | `/v1/providers/ses/events/{token}` | Secret URL | Amazon SES/SNS delivery events |
| * | `/dashboard/*` | Login cookie | Everything the dashboard uses |

Errors always look like: `{"error": {"code": "...", "message": "...", "hint": "..."}}`

## Drive Assets: website files from Google Drive

Clients keep website files (hero images, logos, videos, PDFs, Google Docs) in a Google Drive
folder. Developers use stable links such as `https://assets.viacodos.com/a/acme/hero.jpg`. When the
client uploads a new file with the **same name**, the website updates within about a minute,
with no code change.

**One-time server setup (Google robot account):**
1. In https://console.cloud.google.com create a project and enable the **Google Drive API**.
2. **IAM & Admin → Service accounts → Create service account** (no roles needed).
3. Open it, go to **Keys → Add key → JSON**, and save the file as `thumbsup-api/google-service-account.json`
   (git-ignored). Treat it like a password.
4. In `.env`, set `GOOGLE_SERVICE_ACCOUNT_FILE=./google-service-account.json`, then restart.

Clients share their folder with the robot's email (shown in the dashboard) as **Viewer**. ThumbsUp
sees only folders shared with it, so no Google security review is needed.

**Ownership check:** every account has its own verification file name, such as
`thumbsup-verify-3f9a1c0b2e`. Nothing in a connected folder is public until a file with that name is
in the folder's top level. Only someone who can add files to the folder can do that, so knowing a
private folder's link is not enough to publish it. Only one account can verify a given folder, and an
unverified claim never blocks the real owner. The verification file is never served and can be
deleted afterwards.

**How it works:**
- ThumbsUp copies each file to its own storage (local disk, or S3 / Cloudflare R2 with
  `ASSET_STORAGE=s3`) and serves it from there. Visitors never hit Google Drive, so its
  hotlinking limits don't apply.
- Changes are picked up in three ways:
  1. Google push notifications (instant, needs a public HTTPS `PUBLIC_BASE_URL`).
  2. The Drive change feed, checked every 15 s.
  3. A full re-scan every `ASSET_POLL_SECONDS`.
- When a file is deleted, the old copy keeps being served for `ASSET_DELETE_GRACE_MINUTES`, so a
  replacement can be uploaded without the site breaking. If two files share a name, the newest
  wins and a warning is shown.
- Names are case-insensitive, and the extension is optional (`/hero` works for `hero.jpg`).
  Subfolders become paths (`gallery/cafe-1.jpg`). Google Docs, Sheets and Slides are served as PDF.
- Images can be resized and converted on the fly: `?w=800&h=600&fit=cover&format=auto|webp|avif&q=80`.
  Videos support byte ranges, so they stream and can be skipped through.
- Files are cached by browsers and CDNs for `ASSET_CACHE_SECONDS`. For production, put a CDN
  (for example Cloudflare) in front of the assets domain.
- Safety: `.exe` and other dangerous types are never served, SVG and HTML get a sandbox
  security policy (no scripts), there's a per-file size limit, each folder can belong to only one
  account, and if access is lost the last copies keep being served.

| Method | Path | Auth |
|---|---|---|
| GET | `/a/{project}/{file path}` | Public (what websites embed) |
| GET | `/v1/assets/projects` | Secret key |
| GET | `/v1/assets/projects/{project}/files` | Secret key |
| POST | `/v1/assets/projects/{project}/sync` | Secret key |

## Sheets: Google Sheets as a database

Customers use a Google Sheet like a small database: our API adds, reads, updates and deletes rows,
and columns are created automatically from code instead of being typed by hand.

**Connecting a sheet** (two ways):

| | Sign in with Google (recommended) | Share with our robot |
|---|---|---|
| How | Customer clicks "Connect Google account"; we create a new sheet or they pick one | Customer shares an existing sheet with the robot email as Editor, then puts a code in its name |
| Google permission | `drive.file` only: we see only the sheets created or picked through ThumbsUp | the robot sees only sheets shared with it |
| Speed limit | Google's 60 writes/minute **per customer** | 60 writes/minute shared by **all** customers |
| Server setup | `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `DATA_ENCRYPTION_KEY` | the Drive Assets service account + Sheets API enabled |

**Setting columns automatically.** Paste any of these and review the changes before they're applied:

- **SQL migrations:** `CREATE TABLE`, `ALTER TABLE ... ADD / DROP / RENAME COLUMN`, `RENAME TO`, `DROP TABLE`.
  Developers can also run them from their project: `POST /v1/sheets/{db}/migrate` with a `name`
  (e.g. `001_init`), so each migration runs only once.
- **HTML / React / Vue / plain JS:** form fields (`name="..."`, with types from `type="email"` etc.),
  `FormData.append(...)`, `JSON.stringify({...})`, `useState({...})`.
- **JSON** samples and **CSV** headers.
- Or add, rename, move and delete columns in the dashboard.

Deleting a column uses Google's own column delete, so the columns to its right move left
(delete B: C becomes B, D becomes C). Our code always addresses columns **by name**, never by
letter, so a developer's code keeps working when columns move.

**Every table:** `id | your columns | created_at | updated_at`. The `id` identifies a row wherever it is.

**Speed and Google's limits.** Writes are queued and sent in batches: any number of queued
inserts, updates and deletes for a tab cost at most 1 read + 3 writes of Google's quota. Reads come
from our copy, which is refreshed from Google at most every `SHEETS_CACHE_SECONDS`. Add `?wait=true`
to a write to wait until it is in the sheet. Google being busy (429/5xx) is retried with backoff;
nothing is lost. If access is removed, writes are kept and sent after the customer reconnects.

**People can edit the sheet by hand.** Rows typed by hand get an id, copy-pasted rows get a new id,
new columns appear automatically, a deleted `id` column is re-added at the end, and a renamed tab is
followed (by Google's tab id).

**Safety.** Values are written as RAW, so `=IMPORTXML(...)` is stored as text and never runs as a
formula. Values are type-checked (text, number, boolean, email, url, phone, date, datetime).
Website forms (`POST /v1/sheets/submit/{table_id}` with a public key) can only add rows, only from
allowed websites, with a honeypot and rate limits, and only if "Website forms can add rows" is on.
Google tokens are encrypted in the database (`DATA_ENCRYPTION_KEY`). The sign-in uses PKCE, a
signed one-time state bound to the logged-in user and a browser cookie, and always returns to
`DASHBOARD_URL` (no open redirect). Robot-shared sheets show nothing, not even their name, until
ownership is verified, and a sheet can belong to one account only.

| Method | Path | Auth |
|---|---|---|
| GET | `/v1/sheets` | Secret key |
| GET | `/v1/sheets/{db}` | Secret key |
| POST | `/v1/sheets/{db}/migrate` | Secret key |
| GET / POST | `/v1/sheets/{db}/{table}/rows` (`limit`, `offset`, `sort`, `order`, `search`, `filter[col]=`) | Secret key |
| GET / PATCH / DELETE | `/v1/sheets/{db}/{table}/rows/{id}` | Secret key |
| POST | `/v1/sheets/submit/{table_id}` | Public key + allowed website |

## Running on Azure

Everything is ready for Azure, with a one-script deployment: see **deploy/azure/README-AZURE.md**.

| Need | Azure service | Setting |
|---|---|---|
| The API (Docker image) | Azure Container Apps | `deploy/azure/main.bicep` |
| Database | Azure Database for PostgreSQL – Flexible Server | `DATABASE_URL=postgresql+psycopg://...?sslmode=require` |
| Secrets | Azure Key Vault (read by the app's managed identity) | `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, ... |
| Files: Drive Assets, email attachments, download links | Azure Blob Storage + managed identity | `ASSET_STORAGE=azure`, `AZURE_STORAGE_ACCOUNT_URL` |
| Email | Azure Communication Services Email; bounces via Event Grid | `EMAIL_PROVIDER=acs`, `ACS_ENDPOINT` or `ACS_CONNECTION_STRING`, `ACS_EVENTS_TOKEN` |

Running several copies (scale-out) is safe: database upgrades take turns (a PostgreSQL lock), and emails,
Drive syncs and Sheets writes are claimed in PostgreSQL, so no two copies do the same work. Every file lives in
Blob Storage, never only on one server's disk. Rate limits are kept per copy (add Redis later for exact shared limits).

## Security

- **Isolated accounts.** Every row has a `user_id`, and every query filters by it. Another account's
  ids return 404.
- **Accounts must verify their email** with a 6-digit code. Until then they can only send to
  themselves, which stops sign-up spam. Password reset uses a 6-digit code too. Codes are hashed,
  single-use, expire after 15 minutes, and lock after 5 wrong tries.
- **Passwords** are hashed with scrypt. Login is rate-limited and doesn't reveal which emails exist.
- **Sessions** use an httpOnly, SameSite cookie (Secure in production). Dashboard CORS only allows
  the console's origin.
- **Secret keys** are stored as SHA-256 hashes and shown once. **Public keys** only work from listed
  websites, only with templates enabled for forms, and only to the template's fixed recipients.
- **No spoofing.** A custom `from` must be on a domain that this account verified with DKIM.
  A domain can only belong to one account.
- **Content safety.** Visitor input is HTML-escaped, subjects can't inject headers, dangerous file
  types are blocked, and forms have a honeypot plus rate limits.
- **Webhooks** are signed with HMAC-SHA256 and retried. Private-network URLs are blocked in
  production (SSRF protection).
- **CSRF:** dashboard changes are only accepted from `DASHBOARD_ORIGINS`. Other ports and
  sub-domains count as "same site" for cookies, so the SameSite cookie alone isn't relied on.
- **Sessions:** logging out or resetting the password signs out every device, because old login
  tokens stop working.
- **Brute force:** logins are limited per IP and per account (10 wrong passwords in 15 minutes
  locks the account temporarily, from any number of IPs).
- **Abuse limits:**
  - Request bodies are capped at `MAX_REQUEST_MB` (40 MB by default), checked before reading.
  - The public form endpoint rate-limits by IP before reading uploads.
  - Auto-replies go at most once per address per day, with links stripped and fields shortened,
    so spammers can't use them to send their text.
- **Real visitor IP:** only the proxy-added entry of `X-Forwarded-For` is trusted
  (`TRUSTED_PROXY_HOPS`), so faked headers can't dodge rate limits.
- **Production headers:** HSTS, nosniff and frame-deny. Download links and assets are sandboxed
  (no scripts).
- **Housekeeping:** expired download-link files and old one-time codes are deleted every hour.
- **Scans:** bandit (0 high or medium issues) and pip-audit (no known vulnerable packages).

Known limits (by design, documented):
- A public key's website check relies on the browser's `Origin` header. Scripts can fake it, so
  public keys only send templates to fixed recipients, with rate limits. CAPTCHA per key is the
  planned next step.
- Rate limits live in memory, so with several API servers use one instance per host or add Redis.

## Tests

```bash
pip install -r requirements.txt
python -m pytest
```

Over 150 tests (including a sweep that hits every dashboard endpoint with another account's ids) cover account isolation, keys, forms, retries, bounces, domains, verification,
password reset, production config checks, the whole Drive Assets flow (S3 and Azure Blob storage, the Google API client), and Sheets against
a fake Google that behaves like the real one (sign-in attacks, batching, column shifting, hand edits,
lost access, retries, parallel writers).

## Next steps (not built yet)

Payment gateway and free-tier limits, CAPTCHA (Turnstile/reCAPTCHA) per public key, scheduled
sending, inbound email, and Redis for rate limits when running several servers.
