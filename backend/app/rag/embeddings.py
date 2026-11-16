import asyncio
from sentence_transformers import SentenceTransformer
from app.core.config import settings


class EmbeddingService:
    """384-dim embedding wrapper using all-MiniLM-L6-v2 (matches all 3 trained model repos)."""

    def __init__(self):
        self._model: SentenceTransformer | None = None

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        return self._model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        def _encode():
            model = self._get_model()
            vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return [vec.tolist() for vec in vectors]

        return await asyncio.to_thread(_encode)

    async def embed_query(self, query: str) -> list[float]:
        vectors = await self.embed_texts([query])
        return vectors[0]


embedding_service = EmbeddingService()