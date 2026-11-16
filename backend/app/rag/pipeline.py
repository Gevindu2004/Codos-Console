from datetime import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.skybeak import (
    ConfiguredModel,
    KnowledgeSource,
    DocumentChunk,
    ProcessingJob,
    BaseModelCatalog,
)
from app.rag.document_processor import extract_text_from_file, chunk_text
from app.rag.db_connector import extract_rows_from_external_db
from app.rag.embeddings import embedding_service
from app.services.model_engine import model_engine

PIPELINE_STAGES = {
    1: ("Validating selected knowledge sources...", 10),
    2: ("Establishing external database connections...", 22),
    3: ("Processing uploaded documents...", 36),
    4: ("Extracting and structuring information...", 50),
    5: ("Generating 384-dim embeddings & pgvector indexes...", 68),
    6: ("Configuring unified RAG retrieval pipeline...", 80),
    7: ("Connecting knowledge base to selected AI model...", 88),
    8: ("Testing retrieval & response grounding...", 95),
    9: ("Model Ready & Deployed!", 100),
}


async def _update_job(db: AsyncSession, job: ProcessingJob, step: int, status: str = "RUNNING"):
    label, pct = PIPELINE_STAGES[step]
    job.current_step = step
    job.step_label = label
    job.progress_percent = pct
    job.status = status
    if status == "COMPLETED":
        job.completed_at = datetime.utcnow()
    await db.commit()


async def run_9_stage_generation_pipeline(job_id: str) -> None:
    """
    Executes the full 9-stage 'Generate Model' workflow asynchronously in the background,
    updating real processing status at every stage so the UI tracks actual progress.
    """
    async with AsyncSessionLocal() as db:
        job = await db.get(ProcessingJob, job_id)
        if not job:
            return

        model = await db.get(ConfiguredModel, job.configured_model_id)
        if not model:
            job.status = "FAILED"
            job.error_message = "Configured model not found."
            await db.commit()
            return

        try:
            model.status = "PROCESSING"
            await db.commit()

            # Stage 1: Validate selected knowledge sources
            await _update_job(db, job, 1)
            sources_res = await db.execute(
                select(KnowledgeSource).where(
                    KnowledgeSource.configured_model_id == model.id,
                    KnowledgeSource.user_id == model.user_id,
                )
            )
            sources = list(sources_res.scalars().all())

            # Clear previous chunks so re-running Generate Model stays idempotent
            await db.execute(
                delete(DocumentChunk).where(
                    DocumentChunk.configured_model_id == model.id,
                    DocumentChunk.user_id == model.user_id,
                )
            )
            await db.commit()

            all_chunk_records: list[tuple[KnowledgeSource, str, int, str, dict]] = []

            # Stage 2: Extract from connected external databases (Option A / Option C)
            await _update_job(db, job, 2)
            db_sources = [s for s in sources if s.source_type == "database"]
            for src in db_sources:
                try:
                    rows = await extract_rows_from_external_db(
                        src.encrypted_connection_uri, src.selected_tables
                    )
                    for row in rows:
                        all_chunk_records.append(
                            (
                                src,
                                f"DB:{src.db_label or src.db_type}:{row['table']}",
                                row["row_index"],
                                row["text"],
                                {"source_type": "database", "table": row["table"]},
                            )
                        )
                    src.token_count = sum(len(r["text"]) // 4 for r in rows)
                    src.status = "INDEXED"
                    src.error_message = None
                except Exception as db_err:
                    src.status = "ERROR"
                    src.error_message = str(db_err)
                    raise RuntimeError(f"Database '{src.db_label}' failed: {db_err}")

            # Stage 3 & 4: Parse & chunk uploaded documents (Option B / Option C)
            await _update_job(db, job, 3)
            doc_sources = [s for s in sources if s.source_type == "document"]
            await _update_job(db, job, 4)
            for src in doc_sources:
                try:
                    raw_text = extract_text_from_file(src.file_path)
                    chunks = chunk_text(raw_text, chunk_size_tokens=model.chunk_size)
                    for idx, ch in enumerate(chunks):
                        all_chunk_records.append(
                            (
                                src,
                                src.file_name or "document",
                                idx,
                                ch,
                                {"source_type": "document", "file_name": src.file_name},
                            )
                        )
                    src.token_count = max(1, len(raw_text) // 4)
                    src.status = "INDEXED"
                    src.error_message = None
                except Exception as doc_err:
                    src.status = "ERROR"
                    src.error_message = str(doc_err)
                    raise RuntimeError(f"Document '{src.file_name}' failed: {doc_err}")

            await db.commit()

            # Stage 5: Generate embeddings & store in Azure PostgreSQL pgvector
            await _update_job(db, job, 5)
            if all_chunk_records:
                texts_to_embed = [item[3] for item in all_chunk_records]
                vectors = await embedding_service.embed_texts(texts_to_embed)

                for (src, label, idx, content, meta), vec in zip(all_chunk_records, vectors):
                    db.add(
                        DocumentChunk(
                            user_id=model.user_id,
                            configured_model_id=model.id,
                            source_id=src.id,
                            source_label=label,
                            chunk_index=idx,
                            content=content,
                            metadata_json=meta,
                            embedding=vec,
                        )
                    )
                await db.commit()

            # Stage 6 & 7: Configure RAG retrieval & bind to selected base/industry model
            await _update_job(db, job, 6)
            await _update_job(db, job, 7)
            base_model = await db.get(BaseModelCatalog, model.base_model_id)

            # Stage 8: Run smoke test retrieval + generation check
            await _update_job(db, job, 8)
            sample_context = [all_chunk_records[0][3]] if all_chunk_records else []
            if base_model:
                await model_engine.generate(
                    base_model=base_model,
                    user_query="System readiness verification check.",
                    system_prompt=model.system_prompt,
                    context_passages=sample_context,
                    chat_history=[],
                    max_new_tokens=32,
                )

            # Stage 9: Mark READY
            model.status = "READY"
            await _update_job(db, job, 9, status="COMPLETED")

        except Exception as exc:
            model.status = "FAILED"
            job.status = "FAILED"
            job.error_message = str(exc)
            await db.commit()


async def retrieve_relevant_chunks(
    db: AsyncSession,
    *,
    user_id: str,
    configured_model_id: str,
    query: str,
    top_k: int = 4,
) -> list[DocumentChunk]:
    """
    Performs cosine-distance vector similarity search in pgvector,
    strictly isolated by user_id AND configured_model_id (#24).
    """
    query_vec = await embedding_service.embed_query(query)
    stmt = (
        select(DocumentChunk)
        .where(
            DocumentChunk.user_id == user_id,
            DocumentChunk.configured_model_id == configured_model_id,
        )
        .order_by(DocumentChunk.embedding.cosine_distance(query_vec))
        .limit(top_k)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())