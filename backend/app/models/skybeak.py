import uuid
from datetime import datetime
from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.core.database import Base
from app.core.config import settings


def generate_uuid() -> str:
    return str(uuid.uuid4())


class BaseModelCatalog(Base):
    """Catalog of SkyBeak General & Industry-Specific foundation + LoRA models."""
    __tablename__ = "base_model_catalog"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # e.g., "skybeak-general-llama3", "skybeak-sme-v4"
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)  # "general" | "industry"
    industry: Mapped[str | None] = mapped_column(String(80), nullable=True)  # "SME Business", "Healthcare", "Retail & Manufacturing"
    base_hf_repo: Mapped[str] = mapped_column(String(180), nullable=False)
    adapter_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    adapter_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    default_system_prompt: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ConfiguredModel(Base):
    """A user's personalized SkyBeak AI model instance with isolated RAG knowledge base."""
    __tablename__ = "configured_models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    base_model_id: Mapped[str] = mapped_column(ForeignKey("base_model_catalog.id"), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(80), nullable=True)
    system_prompt: Mapped[str] = mapped_column(Text, default="You are SkyBeak AI, a helpful enterprise assistant.")
    temperature: Mapped[float] = mapped_column(Float, default=0.3)
    chunk_size: Mapped[int] = mapped_column(Integer, default=512)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT")  # DRAFT | PROCESSING | READY | FAILED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sources: Mapped[list["KnowledgeSource"]] = relationship(back_populates="model", cascade="all, delete-orphan")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="model", cascade="all, delete-orphan")
    jobs: Mapped[list["ProcessingJob"]] = relationship(back_populates="model", cascade="all, delete-orphan")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="model", cascade="all, delete-orphan")


class KnowledgeSource(Base):
    """Tracks uploaded documents and connected external databases (non-mutually exclusive)."""
    __tablename__ = "knowledge_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    configured_model_id: Mapped[str] = mapped_column(ForeignKey("configured_models.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "document" | "database"

    # Document fields
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_format: Mapped[str | None] = mapped_column(String(20), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    # External Database fields (credentials encrypted with Fernet)
    db_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # "postgresql" | "mysql" | "mssql"
    db_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    encrypted_connection_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_tables: Mapped[list | None] = mapped_column(JSON, nullable=True)

    status: Mapped[str] = mapped_column(String(32), default="PENDING")  # PENDING | INDEXED | ERROR
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    model: Mapped["ConfiguredModel"] = relationship(back_populates="sources")


class DocumentChunk(Base):
    """Vector-indexed text chunks from both uploaded docs and serialized DB rows."""
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    configured_model_id: Mapped[str] = mapped_column(ForeignKey("configured_models.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("knowledge_sources.id", ondelete="CASCADE"), index=True)
    source_label: Mapped[str] = mapped_column(String(255), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.EMBEDDING_DIM))

    model: Mapped["ConfiguredModel"] = relationship(back_populates="chunks")


Index("ix_chunks_user_model", DocumentChunk.user_id, DocumentChunk.configured_model_id)


class ProcessingJob(Base):
    """Tracks real-time progress across the 9-stage 'Generate Model' pipeline."""
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    configured_model_id: Mapped[str] = mapped_column(ForeignKey("configured_models.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="QUEUED")  # QUEUED | RUNNING | COMPLETED | FAILED
    current_step: Mapped[int] = mapped_column(Integer, default=0)  # 1..9
    step_label: Mapped[str] = mapped_column(String(180), default="Initializing pipeline...")
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    model: Mapped["ConfiguredModel"] = relationship(back_populates="jobs")


class ApiKey(Base):
    """Developer API keys bound to a specific user & configured model."""
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    configured_model_id: Mapped[str] = mapped_column(ForeignKey("configured_models.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), default="Default Production Key")
    key_prefix: Mapped[str] = mapped_column(String(24), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    model: Mapped["ConfiguredModel"] = relationship(back_populates="api_keys")


class ChatMessageRecord(Base):
    """Persistent conversation history per configured model & user."""
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    configured_model_id: Mapped[str] = mapped_column(ForeignKey("configured_models.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources_used: Mapped[list | None] = mapped_column(JSON, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UsageLog(Base):
    """Telemetry for Usage Analytics dashboard (#21)."""
    __tablename__ = "usage_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    configured_model_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)  # "web_chat" | "external_api"
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    status_code: Mapped[int] = mapped_column(Integer, default=200)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CustomFeatureRequest(Base):
    """Stores user requests for custom AI capabilities (#23)."""
    __tablename__ = "custom_feature_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    configured_model_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="SUBMITTED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)