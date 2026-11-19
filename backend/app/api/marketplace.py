import re
import secrets
from datetime import datetime
from typing import Annotated
from urllib.parse import urlsplit

import yaml
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import encrypt_secret
from app.models.marketplace import Developer, MarketplaceProduct, generate_uuid
from app.schemas.marketplace import (
    MarketplaceDeveloperCreate,
    MarketplaceDeveloperRead,
    MarketplaceDeveloperStatusUpdate,
    MarketplaceProductCreate,
    MarketplaceProductRead,
    MarketplaceProductStatusUpdate,
)

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


def make_slug(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-") or "product"


def parse_openapi_spec(value: dict | str | None) -> dict | None:
    if value is None or isinstance(value, dict):
        return value
    try:
        parsed = yaml.safe_load(value)
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=422, detail="OpenAPI document must be valid JSON or YAML.") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail="OpenAPI document must be a JSON/YAML object.")
    return parsed


def first_api_operation(spec: dict | None) -> tuple[str, str, bool]:
    methods = ("get", "post", "put", "patch", "delete")
    paths = (spec or {}).get("paths", {})
    if not isinstance(paths, dict):
        return "/", "GET", False
    for path, operations in paths.items():
        if not isinstance(path, str) or not re.fullmatch(r"/[A-Za-z0-9._~:/{}-]*", path):
            continue
        if not isinstance(operations, dict):
            continue
        for method in methods:
            operation = operations.get(method)
            if isinstance(operation, dict):
                has_body = "requestBody" in operation or method in {"post", "put", "patch"}
                return path, method.upper(), has_body
    return "/", "GET", False


def create_integration_snippets(
    gateway_url: str,
    endpoint_path: str,
    method: str,
    has_body: bool,
) -> dict[str, str]:
    endpoint_url = f"{gateway_url}/{endpoint_path.lstrip('/')}" if endpoint_path.strip("/") else f"{gateway_url}/"
    body = '{"input": "your input"}'
    curl_body = f" \\\n  --data '{body}'" if has_body else ""
    python_body = '    json={"input": "your input"},\n' if has_body else ""
    typescript_body = '  body: JSON.stringify({ input: "your input" }),\n' if has_body else ""
    return {
        "curl": (
            f"curl --request {method} '{endpoint_url}' \\\n"
            "  --header 'X-CODOS-API-Key: YOUR_CODOS_API_KEY' \\\n"
            f"  --header 'Content-Type: application/json'{curl_body}"
        ),
        "python": (
            "import requests\n\n"
            f"url = \"{endpoint_url}\"\n"
            "headers = {\n"
            "    \"X-CODOS-API-Key\": \"YOUR_CODOS_API_KEY\",\n"
            "    \"Content-Type\": \"application/json\",\n"
            "}\n"
            f"response = requests.request(\n    \"{method}\", url, headers=headers,\n{python_body})\n"
            "response.raise_for_status()\n"
            "print(response.json())"
        ),
        "typescript": (
            f"const response = await fetch(\"{endpoint_url}\", {{\n"
            f"  method: \"{method}\",\n"
            "  headers: {\n"
            "    \"X-CODOS-API-Key\": \"YOUR_CODOS_API_KEY\",\n"
            "    \"Content-Type\": \"application/json\",\n"
            "  },\n"
            f"{typescript_body}"
            "});\n"
            "if (!response.ok) throw new Error(`Request failed: ${response.status}`);\n"
            "const result = await response.json();\n"
            "console.log(result);"
        ),
    }


def integration_metadata(
    product_type: str,
    slug: str,
    openapi_spec: dict | None,
    io_schema: dict | None,
) -> tuple[str, str, dict[str, str]]:
    gateway_url = f"{settings.MARKETPLACE_GATEWAY_BASE_URL.rstrip('/')}/{slug}"
    public_page_url = f"/{'apis' if product_type == 'api' else 'models'}/{slug}"
    if product_type == "api":
        endpoint_path, method, has_body = first_api_operation(openapi_spec)
    else:
        endpoint_path = (io_schema or {}).get("inference_path") or "/infer"
        if (
            not isinstance(endpoint_path, str)
            or not re.fullmatch(r"/[A-Za-z0-9._~:/{}-]*", endpoint_path)
        ):
            endpoint_path = "/infer"
        method, has_body = "POST", True
    snippets = create_integration_snippets(gateway_url, endpoint_path, method, has_body)
    return gateway_url, public_page_url, snippets


def validate_upstream_url(value: str, label: str) -> None:
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise HTTPException(
            status_code=422,
            detail=f"The {label} must be an HTTPS URL without embedded credentials, query, or fragment.",
        )


def require_admin_token(configured_token: str | None, supplied_token: str | None) -> None:
    if not configured_token:
        raise HTTPException(status_code=503, detail="Marketplace admin access is not configured.")
    if not supplied_token or not secrets.compare_digest(supplied_token, configured_token):
        raise HTTPException(status_code=403, detail="Admin authorization is required.")


@router.post(
    "/developers",
    response_model=MarketplaceDeveloperRead,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_developer(
    payload: MarketplaceDeveloperCreate,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    developer = await db.scalar(select(Developer).where(Developer.email == email))
    if developer is None and payload.id:
        developer = await db.get(Developer, payload.id)
        if developer and developer.email != email:
            raise HTTPException(status_code=409, detail="Developer ID is already associated with another email.")
    now = datetime.utcnow()
    if developer is None:
        developer = Developer(
            id=payload.id or generate_uuid(),
            **payload.model_dump(exclude={"id", "email", "website"}, mode="json"),
            email=email,
            website=str(payload.website) if payload.website else None,
            status="pending",
            review_notes="",
            audit_logs=[{
                "timestamp": now.isoformat(),
                "actor": "developer",
                "action": "Registration submitted",
            }],
            submitted_at=now,
        )
        db.add(developer)
    else:
        developer.developer_name = payload.developer_name
        developer.company_name = payload.company_name
        developer.email = email
        developer.email_verified = payload.email_verified
        developer.country = payload.country
        developer.website = str(payload.website) if payload.website else None
        developer.support_contact = payload.support_contact
        developer.status = "pending"
        developer.review_notes = ""
        developer.audit_logs = [
            *(developer.audit_logs or []),
            {
                "timestamp": now.isoformat(),
                "actor": "developer",
                "action": "Registration resubmitted",
            },
        ]
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A developer with this email already exists.") from exc
    await db.refresh(developer)
    return developer


@router.get("/developers/admin", response_model=list[MarketplaceDeveloperRead])
async def list_developers_for_admin(
    db: AsyncSession = Depends(get_db),
    x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
):
    require_admin_token(settings.MARKETPLACE_ADMIN_TOKEN, x_admin_token)
    result = await db.execute(select(Developer).order_by(Developer.submitted_at.desc()))
    return result.scalars().all()


@router.patch(
    "/developers/{developer_id}/status",
    response_model=MarketplaceDeveloperRead,
)
async def update_developer_status(
    developer_id: str,
    payload: MarketplaceDeveloperStatusUpdate,
    db: AsyncSession = Depends(get_db),
    x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
):
    require_admin_token(settings.MARKETPLACE_ADMIN_TOKEN, x_admin_token)
    developer = await db.get(Developer, developer_id)
    if developer is None:
        raise HTTPException(status_code=404, detail="Developer not found.")
    developer.status = payload.status
    developer.review_notes = payload.review_notes
    developer.audit_logs = payload.audit_logs
    await db.commit()
    await db.refresh(developer)
    return developer


@router.post("/products", response_model=MarketplaceProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: MarketplaceProductCreate,
    db: AsyncSession = Depends(get_db),
):
    auth_method = payload.auth_method.lower()
    if auth_method not in {"none", "api_key", "bearer", "basic", "oauth2"}:
        raise HTTPException(status_code=422, detail="Unsupported upstream authentication method.")
    if auth_method != "none" and not payload.upstream_api_key:
        raise HTTPException(status_code=422, detail="An upstream credential is required for this authentication method.")
    if await db.get(Developer, payload.developer_id) is None:
        raise HTTPException(status_code=404, detail="The submitted developer profile was not found.")
    validate_upstream_url(str(payload.base_url), "upstream endpoint")
    if payload.health_check_url:
        validate_upstream_url(str(payload.health_check_url), "health check URL")
    if payload.upstream_auth_header and payload.upstream_auth_header.lower() in {
        "host", "content-length", "connection", "transfer-encoding", "cookie",
        "x-codos-api-key", "proxy-authorization", "proxy-authenticate",
    }:
        raise HTTPException(status_code=422, detail="The upstream authentication header is reserved.")

    slug = payload.slug or make_slug(payload.name)
    openapi_spec = parse_openapi_spec(payload.openapi_spec)
    gateway_url, public_page_url, integration_snippets = integration_metadata(
        payload.product_type,
        slug,
        openapi_spec,
        payload.io_schema,
    )
    product = MarketplaceProduct(
        **payload.model_dump(
            exclude={
                "slug",
                "upstream_api_key",
                "openapi_spec",
                "gateway_url",
                "public_page_url",
                "integration_snippets",
            },
            mode="json",
        ),
        slug=slug,
        gateway_url=gateway_url,
        public_page_url=public_page_url,
        integration_snippets=integration_snippets,
        upstream_api_key=(
            encrypt_secret(payload.upstream_api_key)
            if auth_method != "none" and payload.upstream_api_key
            else None
        ),
        openapi_spec=openapi_spec,
        status="Submitted",
    )
    db.add(product)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A marketplace product with this slug already exists.") from exc
    await db.refresh(product)
    return product


@router.get("/products", response_model=list[MarketplaceProductRead])
async def list_published_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MarketplaceProduct)
        .where(MarketplaceProduct.status == "Published")
        .order_by(MarketplaceProduct.created_at.desc())
    )
    return result.scalars().all()


@router.get("/products/admin", response_model=list[MarketplaceProductRead])
async def list_all_products_for_admin(
    db: AsyncSession = Depends(get_db),
    x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
):
    require_admin_token(settings.MARKETPLACE_ADMIN_TOKEN, x_admin_token)
    result = await db.execute(select(MarketplaceProduct).order_by(MarketplaceProduct.created_at.desc()))
    return result.scalars().all()


@router.get("/products/{slug}", response_model=MarketplaceProductRead)
async def get_published_product(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MarketplaceProduct).where(
            MarketplaceProduct.slug == slug,
            MarketplaceProduct.status == "Published",
        )
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Published marketplace product not found.")
    return product


@router.patch("/products/{product_id}/status", response_model=MarketplaceProductRead)
async def update_product_status(
    product_id: str,
    payload: MarketplaceProductStatusUpdate,
    db: AsyncSession = Depends(get_db),
    x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
):
    require_admin_token(settings.MARKETPLACE_ADMIN_TOKEN, x_admin_token)

    product = await db.get(MarketplaceProduct, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Marketplace product not found.")
    product.status = payload.status
    product.review_notes = payload.review_notes
    product.audit_logs = payload.audit_logs
    await db.commit()
    await db.refresh(product)
    return product
