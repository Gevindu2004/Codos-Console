import io
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Header,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    encrypt_secret,
    generate_skybeak_api_key,
    hash_api_key,
)
from app.models.skybeak import (
    ApiKey,
    BaseModelCatalog,
    ChatMessageRecord,
    ConfiguredModel,
    CustomFeatureRequest,
    DocumentChunk,
    KnowledgeSource,
    ProcessingJob,
    UsageLog,
)
from app.rag.db_connector import test_and_inspect_external_db
from app.rag.pipeline import (
    retrieve_relevant_chunks,
    run_9_stage_generation_pipeline,
)
from app.services.model_engine import model_engine

router = APIRouter(prefix="/skybeak", tags=["SkyBeak AI Platform"])


# ---------------------------------------------------------------------------
# Tenant / User Isolation Dependency (#24)
# ---------------------------------------------------------------------------
async def get_current_user_id(
    x_user_id: Optional[str] = Header(default="demo-enterprise-user", alias="X-User-Id")
) -> str:
    if not x_user_id or not x_user_id.strip():
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    return x_user_id.strip()


async def _get_owned_model(
    db: AsyncSession, model_id: str, user_id: str
) -> ConfiguredModel:
    res = await db.execute(
        select(ConfiguredModel).where(
            ConfiguredModel.id == model_id,
            ConfiguredModel.user_id == user_id,
        )
    )
    model = res.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Configured model not found")
    return model


# ---------------------------------------------------------------------------
# Pydantic Request Schemas
# ---------------------------------------------------------------------------
class CreateConfiguredModelRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=140)
    base_model_id: str
    system_prompt: Optional[str] = None
    temperature: float = Field(default=0.3, ge=0.0, le=1.5)
    chunk_size: int = Field(default=512, ge=128, le=2048)


class UpdateConfiguredModelRequest(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=1.5)
    chunk_size: Optional[int] = Field(default=None, ge=128, le=2048)


class DatabaseTestRequest(BaseModel):
    connection_uri: str


class ConnectDatabaseRequest(BaseModel):
    db_type: str = Field(..., pattern="^(postgresql|mysql|mssql)$")
    db_label: str = Field(..., min_length=1, max_length=120)
    connection_uri: str
    selected_tables: Optional[list[str]] = None


class ChatCompletionRequest(BaseModel):
    message: str = Field(..., min_length=1)
    use_rag: bool = True
    top_k: int = Field(default=4, ge=1, le=12)
    temperature: Optional[float] = None


class CreateApiKeyRequest(BaseModel):
    name: str = Field(default="Production Integration Key", max_length=100)


class CustomFeatureRequestBody(BaseModel):
    configured_model_id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=160)
    details: str = Field(..., min_length=10)


# ---------------------------------------------------------------------------
# 1. Model Catalog & User Workspace Models
# ---------------------------------------------------------------------------
@router.get("/catalog")
async def list_base_model_catalog(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(BaseModelCatalog).where(BaseModelCatalog.is_active == True)  # noqa: E712
    )
    items = res.scalars().all()
    return {
        "general_models": [m for m in items if m.category == "general"],
        "industry_models": [m for m in items if m.category == "industry"],
    }


@router.post("/models", status_code=status.HTTP_201_CREATED)
async def create_configured_model(
    payload: CreateConfiguredModelRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    base = await db.get(BaseModelCatalog, payload.base_model_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base model ID not found in catalog")

    new_model = ConfiguredModel(
        user_id=user_id,
        name=payload.name,
        base_model_id=base.id,
        industry=base.industry,
        system_prompt=payload.system_prompt or base.default_system_prompt,
        temperature=payload.temperature,
        chunk_size=payload.chunk_size,
        # General models are immediately READY for chat even before adding docs
        status="READY" if base.category == "general" else "DRAFT",
    )
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)
    return new_model


@router.get("/models")
async def list_user_models(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(ConfiguredModel)
        .where(ConfiguredModel.user_id == user_id)
        .order_by(ConfiguredModel.created_at.desc())
    )
    return res.scalars().all()


@router.get("/models/{model_id}")
async def get_user_model_details(
    model_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)
    sources_res = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.configured_model_id == model.id,
            KnowledgeSource.user_id == user_id,
        )
    )
    keys_res = await db.execute(
        select(ApiKey).where(
            ApiKey.configured_model_id == model.id,
            ApiKey.user_id == user_id,
        )
    )
    jobs_res = await db.execute(
        select(ProcessingJob)
        .where(ProcessingJob.configured_model_id == model.id)
        .order_by(ProcessingJob.started_at.desc())
        .limit(1)
    )
    latest_job = jobs_res.scalar_one_or_none()
    return {
        "model": model,
        "knowledge_sources": [
            {
                "id": s.id,
                "source_type": s.source_type,
                "file_name": s.file_name,
                "file_format": s.file_format,
                "file_size_bytes": s.file_size_bytes,
                "db_type": s.db_type,
                "db_label": s.db_label,
                "selected_tables": s.selected_tables,
                "token_count": s.token_count,
                "status": s.status,
                "error_message": s.error_message,
                "created_at": s.created_at,
            }
            for s in sources_res.scalars().all()
        ],
        "api_keys": [
            {
                "id": k.id,
                "name": k.name,
                "key_prefix": k.key_prefix,
                "is_active": k.is_active,
                "created_at": k.created_at,
                "last_used_at": k.last_used_at,
            }
            for k in keys_res.scalars().all()
        ],
        "latest_job": latest_job,
    }


@router.patch("/models/{model_id}")
async def update_user_model(
    model_id: str,
    payload: UpdateConfiguredModelRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)
    if payload.name is not None:
        model.name = payload.name
    if payload.system_prompt is not None:
        model.system_prompt = payload.system_prompt
    if payload.temperature is not None:
        model.temperature = payload.temperature
    if payload.chunk_size is not None:
        model.chunk_size = payload.chunk_size
    await db.commit()
    await db.refresh(model)
    return model


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_model(
    model_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)
    await db.delete(model)
    await db.commit()


# ---------------------------------------------------------------------------
# 2. Knowledge Sources: Documents + External Databases (Non-Mutually Exclusive)
# ---------------------------------------------------------------------------
@router.post("/models/{model_id}/sources/documents")
async def upload_model_documents(
    model_id: str,
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)
    target_dir = Path(settings.UPLOAD_DIR) / user_id / model.id
    target_dir.mkdir(parents=True, exist_ok=True)

    created_sources = []
    for upload in files:
        safe_name = Path(upload.filename or "document.txt").name
        dest_path = target_dir / f"{datetime.utcnow().timestamp():.0f}_{safe_name}"
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)

        size_bytes = dest_path.stat().st_size
        src = KnowledgeSource(
            user_id=user_id,
            configured_model_id=model.id,
            source_type="document",
            file_name=safe_name,
            file_path=str(dest_path),
            file_format=dest_path.suffix.lstrip(".").upper() or "TXT",
            file_size_bytes=size_bytes,
            status="PENDING",
        )
        db.add(src)
        created_sources.append(src)

    await db.commit()
    for s in created_sources:
        await db.refresh(s)
    return {"uploaded": len(created_sources), "sources": created_sources}


@router.post("/databases/test")
async def test_database_connection(payload: DatabaseTestRequest):
    try:
        result = await test_and_inspect_external_db(payload.connection_uri)
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Database connection failed: {exc}")


@router.post("/models/{model_id}/sources/database")
async def attach_database_source(
    model_id: str,
    payload: ConnectDatabaseRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)
    try:
        inspection = await test_and_inspect_external_db(payload.connection_uri)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not connect to database: {exc}")

    tables_to_use = payload.selected_tables or inspection["tables"]
    src = KnowledgeSource(
        user_id=user_id,
        configured_model_id=model.id,
        source_type="database",
        db_type=payload.db_type,
        db_label=payload.db_label,
        encrypted_connection_uri=encrypt_secret(payload.connection_uri),
        selected_tables=tables_to_use,
        status="PENDING",
    )
    db.add(src)
    await db.commit()
    await db.refresh(src)
    return {
        "id": src.id,
        "db_label": src.db_label,
        "db_type": src.db_type,
        "selected_tables": src.selected_tables,
        "available_tables": inspection["tables"],
        "status": src.status,
    }


@router.delete("/models/{model_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_knowledge_source(
    model_id: str,
    source_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_model(db, model_id, user_id)
    res = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.configured_model_id == model_id,
            KnowledgeSource.user_id == user_id,
        )
    )
    src = res.scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Knowledge source not found")
    await db.delete(src)
    await db.commit()


# ---------------------------------------------------------------------------
# 3. Generate Model (9-Stage RAG Pipeline + Real Progress + Retry)
# ---------------------------------------------------------------------------
@router.post("/models/{model_id}/generate")
async def trigger_generate_model(
    model_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)

    # Auto-provision a default developer API key if the model doesn't have one yet
    keys_res = await db.execute(
        select(ApiKey).where(ApiKey.configured_model_id == model.id, ApiKey.is_active == True)  # noqa: E712
    )
    initial_raw_key = None
    if not keys_res.scalar_one_or_none():
        raw_key, prefix, key_hash = generate_skybeak_api_key()
        db.add(
            ApiKey(
                user_id=user_id,
                configured_model_id=model.id,
                name="Default SkyBeak API Key",
                key_prefix=prefix,
                key_hash=key_hash,
            )
        )
        initial_raw_key = raw_key

    job = ProcessingJob(
        user_id=user_id,
        configured_model_id=model.id,
        status="QUEUED",
        current_step=0,
        step_label="Queued for RAG indexing & model binding...",
        progress_percent=5,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(run_9_stage_generation_pipeline, job.id)
    return {
        "job_id": job.id,
        "model_id": model.id,
        "status": job.status,
        "initial_api_key": initial_raw_key,
    }


@router.get("/jobs/{job_id}")
async def get_processing_job_status(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(ProcessingJob).where(
            ProcessingJob.id == job_id,
            ProcessingJob.user_id == user_id,
        )
    )
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Processing job not found")
    return job


# ---------------------------------------------------------------------------
# 4. Online Chatbot Interface (#15, #22) & External Developer API Gateway (#17)
# ---------------------------------------------------------------------------
async def _execute_rag_chat(
    db: AsyncSession,
    model: ConfiguredModel,
    payload: ChatCompletionRequest,
    channel: str,
) -> dict:
    base_model = await db.get(BaseModelCatalog, model.base_model_id)
    if not base_model:
        raise HTTPException(status_code=500, detail="Base model missing from catalog")

    # Retrieve top-k grounded chunks from pgvector (both Docs & DB rows)
    chunks = []
    if payload.use_rag:
        chunks = await retrieve_relevant_chunks(
            db,
            user_id=model.user_id,
            configured_model_id=model.id,
            query=payload.message,
            top_k=payload.top_k,
        )
    passages = [c.content for c in chunks]
    sources_used = list({c.source_label for c in chunks})

    # Load recent conversation history for web chat continuity
    history_res = await db.execute(
        select(ChatMessageRecord)
        .where(
            ChatMessageRecord.configured_model_id == model.id,
            ChatMessageRecord.user_id == model.user_id,
        )
        .order_by(ChatMessageRecord.created_at.desc())
        .limit(6)
    )
    recent_turns = [
        {"role": m.role, "content": m.content}
        for m in reversed(list(history_res.scalars().all()))
    ]

    gen = await model_engine.generate(
        base_model=base_model,
        user_query=payload.message,
        system_prompt=model.system_prompt,
        context_passages=passages,
        chat_history=recent_turns if channel == "web_chat" else [],
        temperature=payload.temperature if payload.temperature is not None else model.temperature,
    )

    if channel == "web_chat":
        db.add(
            ChatMessageRecord(
                user_id=model.user_id,
                configured_model_id=model.id,
                role="user",
                content=payload.message,
            )
        )
        db.add(
            ChatMessageRecord(
                user_id=model.user_id,
                configured_model_id=model.id,
                role="assistant",
                content=gen["reply"],
                sources_used=sources_used,
                latency_ms=gen["latency_ms"],
                tokens_used=gen["prompt_tokens"] + gen["completion_tokens"],
            )
        )

    db.add(
        UsageLog(
            user_id=model.user_id,
            configured_model_id=model.id,
            channel=channel,
            prompt_tokens=gen["prompt_tokens"],
            completion_tokens=gen["completion_tokens"],
            latency_ms=gen["latency_ms"],
            status_code=200,
        )
    )
    await db.commit()

    return {
        "model_id": model.id,
        "model_name": model.name,
        "reply": gen["reply"],
        "sources_used": sources_used,
        "rag_chunks_retrieved": len(chunks),
        "latency_ms": gen["latency_ms"],
        "tokens": gen["prompt_tokens"] + gen["completion_tokens"],
    }


@router.post("/models/{model_id}/chat")
async def chat_with_configured_model(
    model_id: str,
    payload: ChatCompletionRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)
    return await _execute_rag_chat(db, model, payload, channel="web_chat")


@router.get("/models/{model_id}/chat/history")
async def get_chat_history(
    model_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_model(db, model_id, user_id)
    res = await db.execute(
        select(ChatMessageRecord)
        .where(
            ChatMessageRecord.configured_model_id == model_id,
            ChatMessageRecord.user_id == user_id,
        )
        .order_by(ChatMessageRecord.created_at.asc())
    )
    return res.scalars().all()


@router.post("/external/chat")
async def external_developer_api_chat(
    payload: ChatCompletionRequest,
    authorization: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db),
):
    """
    Public Developer Endpoint (#17): Authenticate via `Authorization: Bearer sb_live_...`
    and query the bound RAG-configured model from external apps.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    raw_key = authorization.removeprefix("Bearer ").strip()
    key_hash = hash_api_key(raw_key)

    res = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)  # noqa: E712
    )
    api_key = res.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or revoked SkyBeak API key")

    api_key.last_used_at = datetime.utcnow()
    model = await db.get(ConfiguredModel, api_key.configured_model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Target model no longer exists")

    return await _execute_rag_chat(db, model, payload, channel="external_api")


# ---------------------------------------------------------------------------
# 5. API Key Management (#16, #18), Dataset Download (#19), Analytics (#21), Custom Requests (#23)
# ---------------------------------------------------------------------------
@router.post("/models/{model_id}/keys")
async def create_model_api_key(
    model_id: str,
    payload: CreateApiKeyRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    model = await _get_owned_model(db, model_id, user_id)
    raw_key, prefix, key_hash = generate_skybeak_api_key()
    record = ApiKey(
        user_id=user_id,
        configured_model_id=model.id,
        name=payload.name,
        key_prefix=prefix,
        key_hash=key_hash,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {
        "id": record.id,
        "name": record.name,
        "api_key": raw_key,  # Shown once upon creation
        "key_prefix": record.key_prefix,
        "created_at": record.created_at,
    }


@router.delete("/models/{model_id}/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_model_api_key(
    model_id: str,
    key_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_model(db, model_id, user_id)
    res = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.configured_model_id == model_id,
            ApiKey.user_id == user_id,
        )
    )
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="API key not found")
    record.is_active = False
    await db.commit()


@router.get("/models/{model_id}/knowledge-base/export")
async def download_processed_knowledge_base(
    model_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Task #19: Download processed & chunked knowledge-base dataset as JSONL."""
    model = await _get_owned_model(db, model_id, user_id)
    res = await db.execute(
        select(DocumentChunk)
        .where(
            DocumentChunk.configured_model_id == model.id,
            DocumentChunk.user_id == user_id,
        )
        .order_by(DocumentChunk.source_label, DocumentChunk.chunk_index)
    )
    chunks = res.scalars().all()
    lines = [
        json.dumps(
            {
                "source": c.source_label,
                "chunk_index": c.chunk_index,
                "text": c.content,
                "metadata": c.metadata_json,
            }
        )
        for c in chunks
    ]
    payload = "\n".join(lines)
    return StreamingResponse(
        io.BytesIO(payload.encode("utf-8")),
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f'attachment; filename="{model.name}-knowledge-base.jsonl"'
        },
    )


@router.get("/analytics")
async def get_user_usage_analytics(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Task #21: Monitor API usage, requests, tokens, and latency."""
    total_res = await db.execute(
        select(
            func.count(UsageLog.id),
            func.coalesce(func.sum(UsageLog.prompt_tokens + UsageLog.completion_tokens), 0),
            func.coalesce(func.avg(UsageLog.latency_ms), 0),
        ).where(UsageLog.user_id == user_id)
    )
    total_requests, total_tokens, avg_latency = total_res.one()

    by_channel_res = await db.execute(
        select(UsageLog.channel, func.count(UsageLog.id))
        .where(UsageLog.user_id == user_id)
        .group_by(UsageLog.channel)
    )
    channel_counts = {row[0]: row[1] for row in by_channel_res.all()}

    return {
        "total_requests": int(total_requests),
        "total_tokens": int(total_tokens),
        "avg_latency_ms": round(float(avg_latency), 1),
        "web_chat_requests": channel_counts.get("web_chat", 0),
        "external_api_requests": channel_counts.get("external_api", 0),
    }


@router.post("/custom-requests", status_code=status.HTTP_201_CREATED)
async def submit_custom_feature_request(
    payload: CustomFeatureRequestBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Task #23: Submit requests for customized AI functionality."""
    req = CustomFeatureRequest(
        user_id=user_id,
        configured_model_id=payload.configured_model_id,
        title=payload.title,
        details=payload.details,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req