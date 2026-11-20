"""ThumbsUp Email API — entry point.

Run:  uvicorn app.main:app --port 8001
Docs: http://localhost:8001/docs
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import ConfigError, settings
from app.db import init_db
from app.deps import ApiError
from app.routers import assets, auth, sheets, domains, emails, keys, provider_events, public_api, suppressions, templates, webhooks
from app.services import asset_sync, queue, sheets_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logging.getLogger("alembic").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        settings.validate_for_startup()  # stop with a clear message if something is misconfigured
        init_db()
    except ConfigError as exc:
        print(f"\n\033[91m{exc}\033[0m\n", file=sys.stderr, flush=True)
        raise SystemExit(1)
    if settings.WORKER_ENABLED and not settings.is_test:
        queue.start_worker()
        asset_sync.start_worker()
        sheets_engine.start_worker()
    yield
    queue.stop_worker()
    asset_sync.stop_worker()
    sheets_engine.stop_worker()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="ThumbsUp Email — send emails from your servers and websites. Part of Codos Console by Via Codos.",
    lifespan=lifespan,
)


class CorsAndSecurityHeaders(BaseHTTPMiddleware):
    """Two different CORS rules:

    - /dashboard/*  only the Codos Console frontend, with cookies (logged-in users)
    - /v1/*         any website may call it, but WITHOUT cookies; public keys then check
                    the website against the key's allowed list.
    """

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        path = request.url.path
        is_dashboard = path.startswith("/dashboard")
        dashboard_ok = origin in settings.dashboard_origins if origin else False

        cors: dict[str, str] = {}
        if origin and is_dashboard and dashboard_ok:
            cors = {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Vary": "Origin",
            }
        elif origin and path.startswith("/v1"):
            cors = {"Access-Control-Allow-Origin": origin, "Vary": "Origin"}

        # CSRF protection: a logged-in browser must only change things when the request comes from
        # the console itself. (Other ports/sub-domains count as "same site" for cookies, so the
        # SameSite cookie alone is not enough.) Tools without an Origin header (curl, scripts) are fine.
        if is_dashboard and request.method not in ("GET", "HEAD", "OPTIONS"):
            fetch_site = request.headers.get("sec-fetch-site")
            if (origin and not dashboard_ok) or (not origin and fetch_site in ("cross-site", "same-site")):
                return JSONResponse(
                    status_code=403,
                    content={"error": {"code": "bad_origin", "message": "This request didn't come from the ThumbsUp console."}},
                )

        if request.method == "OPTIONS" and request.headers.get("access-control-request-method"):
            if not cors:
                return Response(status_code=403)
            cors.update(
                {
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-ThumbsUp-Key",
                    "Access-Control-Max-Age": "600",
                }
            )
            return Response(status_code=204, headers=cors)

        response = await call_next(request)
        for k, v in cors.items():
            response.headers[k] = v
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if not path.startswith("/a/"):  # website files (PDFs, videos) may be embedded on customers' sites
            response.headers.setdefault("Referrer-Policy", "no-referrer")
            response.headers.setdefault("X-Frame-Options", "DENY")
        return response


class BodySizeLimit:
    """Reject request bodies above MAX_REQUEST_MB before they are read into memory."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        limit = settings.MAX_REQUEST_MB * 1024 * 1024
        headers = dict(scope.get("headers") or [])
        length = headers.get(b"content-length")
        if length is not None and length.isdigit() and int(length) > limit:
            return await self._reject(send)
        seen = 0
        exceeded = False
        replied = False

        async def limited_receive():
            nonlocal seen, exceeded
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > limit:
                    exceeded = True
                    raise _TooLarge()
            return message

        async def guarded_send(message):
            # If the body was too big, replace whatever the app answers with a clear 413
            nonlocal replied
            if exceeded:
                if not replied:
                    replied = True
                    await self._reject(send)
                return
            await send(message)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except _TooLarge:
            if not replied:
                await self._reject(send)

    @staticmethod
    async def _reject(send):
        body = (b'{"error": {"code": "request_too_large", "message": "The request is too large. Max '
                + str(settings.MAX_REQUEST_MB).encode() + b' MB per request (send big files in several emails)."}}')
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


class _TooLarge(Exception):
    pass


app.add_middleware(CorsAndSecurityHeaders)
app.add_middleware(BodySizeLimit)


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError):
    body = {"error": {"code": exc.code, "message": exc.message}}
    if exc.hint:
        body["error"]["hint"] = exc.hint
    return JSONResponse(status_code=exc.status, content=body, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query", "header"))
    msg = first.get("msg", "Invalid request")
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "invalid_request", "message": f"{field}: {msg}" if field else msg}},
    )


for r in (
    auth.router,
    keys.router,
    templates.router,
    emails.router,
    webhooks.router,
    domains.router,
    suppressions.router,
    public_api.router,
    provider_events.router,
    assets.dashboard,
    assets.developer,
    assets.public,
    sheets.public,
    sheets.dashboard,
    sheets.developer,
):
    app.include_router(r)


@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "service": "thumbsup-email",
        "environment": settings.ENVIRONMENT,
        "provider": settings.EMAIL_PROVIDER,
        "sender": settings.DEFAULT_FROM_EMAIL,
        "worker": queue.worker_running(),
        "drive_assets": {"configured": settings.drive_configured, "worker": asset_sync.worker_running(),
                         "storage": settings.ASSET_STORAGE},
        "sheets": {"google_signin": settings.sheets_oauth_configured, "robot": settings.sheets_robot_configured,
                   "worker": sheets_engine.worker_running()},
    }
