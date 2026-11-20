from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.skybeak import router as skybeak_router
from app.api.marketplace import router as marketplace_router
from app.api.gateway import router as gateway_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.models.marketplace import Developer, GatewayUsageLog, MarketplaceProduct
from app.services.model_engine import seed_base_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as db:
        await seed_base_models(db)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(skybeak_router, prefix=settings.API_V1_STR)
app.include_router(marketplace_router, prefix=settings.API_V1_STR)
app.include_router(gateway_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "ok", "inference_mode": settings.INFERENCE_MODE}