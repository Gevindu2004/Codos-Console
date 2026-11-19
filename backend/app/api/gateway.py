import asyncio
import base64
import ipaddress
import socket
import time
from datetime import datetime
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decrypt_secret, hash_api_key
from app.models.marketplace import GatewayUsageLog, MarketplaceProduct
from app.models.skybeak import ApiKey

router = APIRouter(prefix="/gateway", tags=["CODOS API Gateway"])
HOP_BY_HOP_HEADERS = {
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


async def validate_public_target(url: str) -> None:
    from urllib.parse import urlsplit

    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Marketplace upstreams must use a public HTTPS URL.")
    hostname = parsed.hostname.rstrip(".").lower()
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".localhost"):
        raise HTTPException(status_code=400, detail="Private and local upstreams are not allowed.")
    try:
        addresses = await asyncio.to_thread(
            lambda: {
                ipaddress.ip_address(record[4][0])
                for record in socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
            }
        )
    except (OSError, ValueError):
        raise HTTPException(status_code=400, detail="The upstream hostname could not be resolved.") from None
    if not addresses or any(not address.is_global for address in addresses):
        raise HTTPException(status_code=400, detail="Private and non-public upstream addresses are not allowed.")


def upstream_credentials(product: MarketplaceProduct) -> tuple[str, str] | None:
    if product.auth_method.lower() == "none" or not product.upstream_api_key:
        return None
    secret = decrypt_secret(product.upstream_api_key)
    method = product.auth_method.lower()
    header = product.upstream_auth_header or ("Authorization" if method in {"bearer", "oauth2", "basic"} else "X-API-Key")
    if method in {"bearer", "oauth2"} and header.lower() == "authorization":
        secret = secret if secret.lower().startswith("bearer ") else f"Bearer {secret}"
    elif method == "basic" and header.lower() == "authorization":
        secret = f"Basic {base64.b64encode(secret.encode('utf-8')).decode('ascii')}"
    return header, secret


@router.get("/{slug}/{path:path}", name="gateway_get")
@router.post("/{slug}/{path:path}", name="gateway_post")
@router.put("/{slug}/{path:path}", name="gateway_put")
@router.patch("/{slug}/{path:path}", name="gateway_patch")
@router.delete("/{slug}/{path:path}", name="gateway_delete")
async def proxy_marketplace_request(
    slug: str,
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    codos_key: str | None = Header(default=None, alias="X-CODOS-API-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    supplied_key = codos_key
    if not supplied_key and authorization and authorization.lower().startswith("bearer "):
        supplied_key = authorization[7:].strip()
    if not supplied_key:
        raise HTTPException(status_code=401, detail="A CODOS API key is required.")

    key_result = await db.execute(
        select(ApiKey).where(
            ApiKey.key_hash == hash_api_key(supplied_key),
            ApiKey.is_active == True,  # noqa: E712
        )
    )
    customer_key = key_result.scalar_one_or_none()
    if customer_key is None:
        raise HTTPException(status_code=401, detail="The CODOS API key is invalid or inactive.")

    product_result = await db.execute(
        select(MarketplaceProduct).where(
            MarketplaceProduct.slug == slug,
            MarketplaceProduct.status == "Published",
        )
    )
    product = product_result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Published marketplace product not found.")

    segments = path.split("/")
    if any(segment in {".", ".."} for segment in segments):
        raise HTTPException(status_code=400, detail="Invalid upstream endpoint path.")
    await validate_public_target(product.base_url)

    target_url = f"{product.base_url.rstrip('/')}/{quote(path, safe='/@:+,;=-._~')}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"
    headers = {
        name: value
        for name, value in request.headers.items()
        if name.lower() not in HOP_BY_HOP_HEADERS
        and name.lower() not in {"authorization", "x-codos-api-key", "cookie"}
    }
    credentials = upstream_credentials(product)
    if credentials:
        headers[credentials[0]] = credentials[1]

    started = time.perf_counter()
    status_code = 502
    response_content = b'{"detail":"Upstream request failed."}'
    response_headers = {"content-type": "application/json"}
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            follow_redirects=False,
            trust_env=False,
        ) as client:
            upstream = await client.request(
                request.method,
                target_url,
                params=None,
                content=await request.body(),
                headers=headers,
            )
        status_code = upstream.status_code
        response_content = upstream.content
        if upstream.headers.get("content-type"):
            response_headers["content-type"] = upstream.headers["content-type"]
    except httpx.TimeoutException:
        status_code = 504
        response_content = b'{"detail":"Upstream request timed out."}'
    except httpx.HTTPError:
        status_code = 502
        response_content = b'{"detail":"Upstream request failed."}'
    finally:
        latency_ms = round((time.perf_counter() - started) * 1000)
        db.add(
            GatewayUsageLog(
                product_id=product.id,
                developer_id=product.developer_id,
                customer_key_id=customer_key.id,
                endpoint=f"/{path}",
                method=request.method,
                status_code=status_code,
                latency_ms=latency_ms,
                created_at=datetime.utcnow(),
            )
        )
        customer_key.last_used_at = datetime.utcnow()
        await db.commit()

    return Response(content=response_content, status_code=status_code, headers=response_headers)
