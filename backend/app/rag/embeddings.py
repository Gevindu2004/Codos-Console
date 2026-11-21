import asyncio
import hashlib
import math
from typing import Any
from app.core.config import settings


def _hash_fallback_vector(text: str, dim: int) -> list[float]:
    """Deterministic normalized embedding fallback when sentence-transformers is absent."""
    vals: list[float] = []
    seed = text.encode("utf-8", errors="ignore")
    counter = 0
    while len(vals) < dim:
        digest = hashlib.sha256(seed + counter.to_bytes(4, "little")).digest()
        for i in range(0, len(digest), 2):
            if len(vals) >= dim:
                break
            raw = int.from_bytes(digest[i : i + 2], "little", signed=True)
            vals.append(raw / 32768.0)
        counter += 1
    norm = math.sqrt(sum(v * v for v in vals)) or 1.0
    return [v / norm for v in vals]


class EmbeddingService:
    """384-dim embedding wrapper using all-MiniLM-L6-v2 (matches all 3 trained model repos)."""

    def __init__(self):
        self._model: Any = None

    def _get_model(self) -> Any:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        return self._model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        def _encode():
            try:
                model = self._get_model()
                vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
                return [vec.tolist() for vec in vectors]
            except ImportError:
                return [_hash_fallback_vector(t, settings.EMBEDDING_DIM) for t in texts]

        return await asyncio.to_thread(_encode)

    async def embed_query(self, query: str) -> list[float]:
        vectors = await self.embed_texts([query])
        return vectors[0]


embedding_service = EmbeddingService()