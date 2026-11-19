from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "SkyBeak AI Platform API"
    API_V1_STR: str = "/api/v1"

    # Azure Database for PostgreSQL (with pgvector enabled)
    DATABASE_URL: str

    # Encryption key for storing user external DB connection strings (32 url-safe base64 bytes)
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    DB_CREDENTIAL_ENCRYPTION_KEY: str
    MARKETPLACE_ADMIN_TOKEN: Optional[str] = None
    MARKETPLACE_GATEWAY_BASE_URL: str = "http://localhost:8000/api/v1/gateway"

    # Model Serving Mode:
    # "local_gpu" -> loads Qwen2.5-7B / Llama-3-8B + PEFT LoRA adapters directly on local CUDA GPU
    # "remote_worker" -> forwards inference to Colab/Azure GPU endpoint (MODEL_WORKER_URL)
    # "mock_dev" -> fast local CPU fallback for UI/API development without a GPU
    INFERENCE_MODE: str = "mock_dev"
    MODEL_WORKER_URL: Optional[str] = None
    HF_TOKEN: Optional[str] = None

    # Base Models & LoRA Adapter Paths (Local folders or HuggingFace repo IDs)
    QWEN_BASE_MODEL: str = "Qwen/Qwen2.5-7B-Instruct"
    LLAMA_BASE_MODEL: str = "meta-llama/Meta-Llama-3-8B-Instruct"

    ADAPTER_SME_PATH: str = "./adapters/llama_sme_v4"
    ADAPTER_RETAIL_PATH: str = "./adapters/llama_retail_ecom_mfg_v4"
    ADAPTER_HEALTHCARE_PATH: str = "./adapters/llama_healthcare_v4"

    # Embedding Model (384-dim, matching all 3 trained repos)
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384

    # Local / Azure Storage for Uploaded Docs
    UPLOAD_DIR: str = "./storage/uploads"

    # CORS Origins (Next.js frontend)
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()