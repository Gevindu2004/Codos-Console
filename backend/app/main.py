from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.call_colleague import router as call_colleague_router
from app.api.v1.skybeak import router as skybeak_router
from app.api.marketplace import router as marketplace_router
from app.api.gateway import router as gateway_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.models.marketplace import Developer, GatewayUsageLog, MarketplaceProduct
from app.services.model_engine import seed_base_models
from app.services.vapi_service import seed_call_colleague_defaults


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as db:
        await seed_base_models(db)
        await seed_call_colleague_defaults(db)
    yield


app = FastAPI(
    title="Codos Console Unified API (SkyBeak AI + CallColleague.ai)",
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
app.include_router(call_colleague_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "ok", "inference_mode": settings.INFERENCE_MODE}