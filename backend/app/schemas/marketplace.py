from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class MarketplaceDeveloperCreate(BaseModel):
    id: str | None = Field(default=None, min_length=1, max_length=128)
    developer_name: str = Field(min_length=1, max_length=180)
    company_name: str = Field(default="", max_length=180)
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    email_verified: bool = False
    country: str = Field(min_length=1, max_length=120)
    website: HttpUrl | None = None
    support_contact: str = Field(min_length=1, max_length=320)


class MarketplaceDeveloperRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    developer_name: str
    company_name: str
    email: str
    email_verified: bool
    country: str
    website: str | None
    support_contact: str
    status: str
    review_notes: str
    audit_logs: list[dict[str, Any]] | None
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime


class MarketplaceDeveloperStatusUpdate(BaseModel):
    status: Literal["pending", "approved", "rejected", "suspended"]
    review_notes: str = ""
    audit_logs: list[dict[str, Any]] | None = None


class MarketplaceProductCreate(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    developer_id: str = Field(min_length=1, max_length=128)
    provider_type: Literal["third_party", "via_codos"] = "third_party"
    product_type: Literal["api", "model"]
    name: str = Field(min_length=1, max_length=180)
    version: str = Field(default="1.0", max_length=80)
    category: str = Field(min_length=1, max_length=120)
    short_description: str = Field(min_length=1, max_length=500)
    detailed_description: str = Field(min_length=1)
    logo_url: HttpUrl | None = None
    base_url: HttpUrl
    health_check_url: HttpUrl | None = None
    auth_method: str = Field(default="none", max_length=32)
    upstream_auth_header: str | None = Field(default=None, max_length=128, pattern=r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")
    upstream_api_key: str | None = Field(default=None, max_length=4096, repr=False)
    openapi_spec: dict[str, Any] | str | None = None
    io_schema: dict[str, Any] | None = None
    pricing_model: str = Field(default="free", max_length=64)
    pricing_plans: list[dict[str, Any]] | None = None
    rate_limit_rpm: int = Field(default=60, ge=1, le=1_000_000)
    avg_latency_ms: float | None = Field(default=None, ge=0)


class MarketplaceProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    developer_id: str
    provider_type: str
    product_type: str
    name: str
    version: str
    category: str
    short_description: str
    detailed_description: str
    logo_url: str | None
    base_url: str
    health_check_url: str | None
    auth_method: str
    upstream_auth_header: str | None
    openapi_spec: dict[str, Any] | None
    io_schema: dict[str, Any] | None
    pricing_model: str
    pricing_plans: list[dict[str, Any]] | None
    rate_limit_rpm: int
    avg_latency_ms: float | None
    status: str
    review_notes: str
    audit_logs: list[dict[str, Any]] | None
    created_at: datetime
    updated_at: datetime


class MarketplaceProductStatusUpdate(BaseModel):
    status: Literal["Published", "Changes Requested", "Rejected", "Suspended"]
    review_notes: str = ""
    audit_logs: list[dict[str, Any]] | None = None
