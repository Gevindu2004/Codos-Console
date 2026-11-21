import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class CcTenant(Base):
    """Multi-tenant CallColleague.ai business workspace & linked Vapi assistant."""

    __tablename__ = "cc_tenants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="owner@yourbusiness.com")
    business_name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry: Mapped[str] = mapped_column(String(32), nullable=False, default="salon")
    timezone: Mapped[str] = mapped_column(String(80), nullable=False, default="America/New_York")
    plan_tier: Mapped[str] = mapped_column(String(32), nullable=False, default="growth")
    agent_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    voice_persona: Mapped[dict] = mapped_column(JSON, nullable=False)
    vapi_assistant_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    vapi_phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    virtual_phone_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    telephony_setup_type: Mapped[str] = mapped_column(String(40), nullable=False, default="new_dedicated_number")
    forwarding_number: Mapped[str | None] = mapped_column(String(40), nullable=True, default="")
    selected_carrier_id: Mapped[str | None] = mapped_column(String(64), nullable=True, default="dialog_sl")
    is_number_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sip_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    google_calendar_connected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    calendar_email: Mapped[str | None] = mapped_column(String(255), nullable=True, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    operating_hours: Mapped[list["CcOperatingHour"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )
    services: Mapped[list["CcService"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )
    departments: Mapped[list["CcDepartment"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )
    knowledge_faqs: Mapped[list["CcKnowledgeFaq"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )
    call_logs: Mapped[list["CcCallLog"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )
    appointments: Mapped[list["CcAppointment"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )
    voice_api_keys: Mapped[list["CcVoiceApiKey"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )


class CcOperatingHour(Base):
    """Weekly business operating hours for a CallColleague tenant."""

    __tablename__ = "cc_operating_hours"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    day: Mapped[str] = mapped_column(String(20), nullable=False)
    open_time: Mapped[str] = mapped_column(String(10), nullable=False)
    close_time: Mapped[str] = mapped_column(String(10), nullable=False)
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    tenant: Mapped["CcTenant"] = relationship(back_populates="operating_hours")


class CcService(Base):
    """Service pricing, duration & specialist catalog quoted by the AI receptionist."""

    __tablename__ = "cc_services"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    staff_member: Mapped[str | None] = mapped_column(String(150), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    tenant: Mapped["CcTenant"] = relationship(back_populates="services")


class CcDepartment(Base):
    """Warm-transfer destination lines & escalation triggers."""

    __tablename__ = "cc_departments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    tenant: Mapped["CcTenant"] = relationship(back_populates="departments")


class CcKnowledgeFaq(Base):
    """Company policy, parking, pricing & general FAQ rules."""

    __tablename__ = "cc_knowledge_faqs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="policy")
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)

    tenant: Mapped["CcTenant"] = relationship(back_populates="knowledge_faqs")


class CcCallLog(Base):
    """Persisted call transcripts, summaries, sentiment, and recording URLs."""

    __tablename__ = "cc_call_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    vapi_call_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    caller_name: Mapped[str] = mapped_column(String(160), nullable=False, default="Inbound Caller")
    caller_phone: Mapped[str] = mapped_column(String(40), nullable=False, default="Unknown")
    timestamp_label: Mapped[str] = mapped_column(String(80), nullable=False, default="Just now")
    duration: Mapped[str] = mapped_column(String(32), nullable=False, default="1m 00s")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed")
    sentiment: Mapped[str] = mapped_column(String(32), nullable=False, default="positive")
    service_requested: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    recording_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    tenant: Mapped["CcTenant"] = relationship(back_populates="call_logs")


class CcAppointment(Base):
    """Appointments booked via AI receptionist or managed in Admin Portal."""

    __tablename__ = "cc_appointments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    client_name: Mapped[str] = mapped_column(String(160), nullable=False)
    client_phone: Mapped[str] = mapped_column(String(40), nullable=False)
    service_name: Mapped[str] = mapped_column(String(200), nullable=False)
    staff_member: Mapped[str] = mapped_column(String(160), nullable=False, default="Any Specialist")
    date_time: Mapped[str] = mapped_column(String(120), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="confirmed")
    booked_via: Mapped[str] = mapped_column(String(64), nullable=False, default="AI Voice Receptionist")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    gcal_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    tenant: Mapped["CcTenant"] = relationship(back_populates="appointments")


class CcTenantIntegration(Base):
    """Encrypted per-tenant third-party credentials (Google Calendar OAuth)."""

    __tablename__ = "cc_tenant_integrations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(40), nullable=False, default="google_calendar")
    encrypted_credentials: Mapped[str] = mapped_column(Text, nullable=False)
    calendar_id: Mapped[str] = mapped_column(String(255), nullable=False, default="primary")
    account_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class CcVoiceApiKey(Base):
    """Scoped Voice API keys minted inside DeveloperApiDrawer."""

    __tablename__ = "cc_voice_api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("cc_tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(200), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(24), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    masked_secret: Mapped[str] = mapped_column(String(40), nullable=False, default="API**********")
    scopes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    webhook_url: Mapped[str] = mapped_column(Text, nullable=False)
    created_label: Mapped[str] = mapped_column(String(80), nullable=False, default="Just now")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    tenant: Mapped["CcTenant"] = relationship(back_populates="voice_api_keys")
