import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Developer(Base):
    __tablename__ = "developers"

    id: Mapped[str] = mapped_column(String(128), primary_key=True, default=generate_uuid)
    developer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    company_name: Mapped[str] = mapped_column(String(180), default="", nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    country: Mapped[str] = mapped_column(String(120), nullable=False)
    website: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    support_contact: Mapped[str] = mapped_column(String(320), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)
    review_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    audit_logs: Mapped[list | None] = mapped_column(JSON, default=list, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class MarketplaceProduct(Base):
    __tablename__ = "marketplace_products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    developer_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("developers.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    provider_type: Mapped[str] = mapped_column(String(32), default="third_party", nullable=False)
    product_type: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    version: Mapped[str] = mapped_column(String(80), default="1.0", nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    short_description: Mapped[str] = mapped_column(String(500), nullable=False)
    detailed_description: Mapped[str] = mapped_column(Text, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    base_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    health_check_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    gateway_url: Mapped[str] = mapped_column(String(2048), nullable=False, default="")
    public_page_url: Mapped[str] = mapped_column(String(2048), nullable=False, default="")
    integration_snippets: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    auth_method: Mapped[str] = mapped_column(String(32), default="none", nullable=False)
    upstream_auth_header: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Fernet-encrypted at rest; never included in public response schemas.
    upstream_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    openapi_spec: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    io_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pricing_model: Mapped[str] = mapped_column(String(64), default="free", nullable=False)
    pricing_plans: Mapped[list | None] = mapped_column(JSON, nullable=True)
    rate_limit_rpm: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    avg_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="Submitted", index=True, nullable=False)
    review_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    audit_logs: Mapped[list | None] = mapped_column(JSON, default=list, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class GatewayUsageLog(Base):
    __tablename__ = "gateway_usage_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    product_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    developer_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    customer_key_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    endpoint: Mapped[str] = mapped_column(String(2048), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


Index("ix_gateway_usage_product_created", GatewayUsageLog.product_id, GatewayUsageLog.created_at)
