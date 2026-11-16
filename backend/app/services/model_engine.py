import time
import asyncio
import httpx
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.skybeak import BaseModelCatalog

DEFAULT_CATALOG_MODELS = [
    {
        "id": "skybeak-general-llama3",
        "name": "SkyBeak General AI (Llama-3-8B)",
        "category": "general",
        "industry": None,
        "base_hf_repo": settings.LLAMA_BASE_MODEL,
        "adapter_name": None,
        "adapter_path": None,
        "description": "General-purpose SkyBeak foundation model ready for immediate chat or custom RAG grounding.",
        "default_system_prompt": "You are SkyBeak General AI, an accurate and helpful assistant. Answer strictly using the provided RAG context when available.",
    },
    {
        "id": "skybeak-general-qwen25",
        "name": "SkyBeak General AI (Qwen-2.5-7B)",
        "category": "general",
        "industry": None,
        "base_hf_repo": settings.QWEN_BASE_MODEL,
        "adapter_name": None,
        "adapter_path": None,
        "description": "High-speed general-purpose reasoning and coding model.",
        "default_system_prompt": "You are SkyBeak General AI powered by Qwen 2.5. Provide concise, grounded responses.",
    },
    {
        "id": "skybeak-sme-v4",
        "name": "SkyBeak SME Daily Business v4",
        "category": "industry",
        "industry": "SME & Daily Business",
        "base_hf_repo": settings.LLAMA_BASE_MODEL,
        "adapter_name": "sme_v4",
        "adapter_path": settings.ADAPTER_SME_PATH,
        "description": "RAG-aware champion model fine-tuned on SME operations, SOPs, invoicing, and daily business workflows (0.8% hallucination rate).",
        "default_system_prompt": "You are SkyBeak SME Business AI (v4). Use retrieved company SOPs and database records to provide accurate operational guidance.",
    },
    {
        "id": "skybeak-retail-ecom-mfg-v4",
        "name": "SkyBeak Retail, E-Commerce & Manufacturing v4",
        "category": "industry",
        "industry": "Retail, E-commerce & Manufacturing",
        "base_hf_repo": settings.LLAMA_BASE_MODEL,
        "adapter_name": "retail_ecom_mfg_v4",
        "adapter_path": settings.ADAPTER_RETAIL_PATH,
        "description": "Specialized in customer order support, returns, inventory lookup, and Lean Six Sigma manufacturing quality controls.",
        "default_system_prompt": "You are SkyBeak Retail & Manufacturing AI (v4). Resolve customer inquiries and manufacturing process questions using retrieved knowledge.",
    },
    {
        "id": "skybeak-healthcare-v4",
        "name": "SkyBeak Healthcare & Clinical v4",
        "category": "industry",
        "industry": "Healthcare",
        "base_hf_repo": settings.LLAMA_BASE_MODEL,
        "adapter_name": "healthcare_v4",
        "adapter_path": settings.ADAPTER_HEALTHCARE_PATH,
        "description": "RAG-aware clinical and healthcare assistant fine-tuned across four controlled sprint iterations.",
        "default_system_prompt": "You are SkyBeak Healthcare AI (v4). Provide accurate, context-grounded healthcare information based on connected records and documents.",
    },
]


async def seed_base_models(db: AsyncSession) -> None:
    """Ensure the General and 3 Industry-Specific trained models exist in Azure PostgreSQL."""
    for item in DEFAULT_CATALOG_MODELS:
        existing = await db.get(BaseModelCatalog, item["id"])
        if not existing:
            db.add(BaseModelCatalog(**item))
    await db.commit()


class SkyBeakModelEngine:
    """
    Unified inference engine supporting:
    - local_gpu: 4-bit QLoRA base model + dynamic PEFT LoRA adapter hot-swapping (with T4 float16/float32 guards)
    - remote_worker: forwards generation to an external GPU endpoint (Colab/Azure ML)
    - mock_dev: deterministic CPU fallback for local API & UI integration testing
    """

    def __init__(self):
        self._tokenizer = None
        self._model = None
        self._loaded_adapters: set[str] = set()
        self._lock = asyncio.Lock()

    def _build_rag_prompt(
        self,
        user_query: str,
        system_prompt: str,
        context_passages: list[str],
        chat_history: list[dict[str, str]],
    ) -> str:
        """
        Formats prompt with the explicit `context` section that the v3/v4 RAG-aware
        models in all 3 repositories were trained to read.
        """
        context_block = (
            "\n\n---\n".join(context_passages)
            if context_passages
            else "No external knowledge base context provided."
        )

        history_lines = []
        for turn in chat_history[-6:]:
            role_label = "User" if turn["role"] == "user" else "Assistant"
            history_lines.append(f"{role_label}: {turn['content']}")
        history_block = "\n".join(history_lines)

        return (
            f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n"
            f"{system_prompt}\n\n"
            f"### Context:\n{context_block}<|eot_id|>\n"
            f"{history_block}\n"
            f"<|start_header_id|>user<|end_header_id|>\n"
            f"{user_query}<|eot_id|>\n"
            f"<|start_header_id|>assistant<|end_header_id|>\n"
        )

    def _ensure_local_gpu_loaded(self, base_repo: str, adapter_name: Optional[str], adapter_path: Optional[str]):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import PeftModel

        if self._model is None:
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=torch.float16,  # Tesla T4 guard from SME README
            )
            self._tokenizer = AutoTokenizer.from_pretrained(base_repo, token=settings.HF_TOKEN)
            base_model = AutoModelForCausalLM.from_pretrained(
                base_repo,
                quantization_config=bnb_config,
                device_map="auto",
                torch_dtype=torch.float16,
                token=settings.HF_TOKEN,
            )
            self._model = base_model

        if adapter_name and adapter_path:
            if adapter_name not in self._loaded_adapters:
                if not isinstance(self._model, PeftModel):
                    self._model = PeftModel.from_pretrained(
                        self._model, adapter_path, adapter_name=adapter_name
                    )
                else:
                    self._model.load_adapter(adapter_path, adapter_name=adapter_name)
                self._loaded_adapters.add(adapter_name)
            self._model.enable_adapter_layers()
            self._model.set_adapter(adapter_name)
        elif hasattr(self._model, "disable_adapter_layers"):
            # General AI Model mode: disable industry LoRA weights
            self._model.disable_adapter_layers()

    async def generate(
        self,
        *,
        base_model: BaseModelCatalog,
        user_query: str,
        system_prompt: str,
        context_passages: list[str],
        chat_history: list[dict[str, str]],
        temperature: float = 0.3,
        max_new_tokens: int = 512,
    ) -> dict:
        start = time.perf_counter()
        formatted_prompt = self._build_rag_prompt(
            user_query=user_query,
            system_prompt=system_prompt,
            context_passages=context_passages,
            chat_history=chat_history,
        )

        # Mode 1: Remote GPU Worker (e.g., Colab T4 or Azure ML endpoint)
        if settings.INFERENCE_MODE == "remote_worker" and settings.MODEL_WORKER_URL:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.MODEL_WORKER_URL.rstrip('/')}/infer",
                    json={
                        "base_hf_repo": base_model.base_hf_repo,
                        "adapter_name": base_model.adapter_name,
                        "prompt": formatted_prompt,
                        "temperature": temperature,
                        "max_new_tokens": max_new_tokens,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                latency_ms = int((time.perf_counter() - start) * 1000)
                return {
                    "reply": data["text"],
                    "latency_ms": latency_ms,
                    "prompt_tokens": data.get("prompt_tokens", len(formatted_prompt) // 4),
                    "completion_tokens": data.get("completion_tokens", len(data["text"]) // 4),
                }

        # Mode 2: Local CUDA GPU with PEFT LoRA Adapter Hot-Swapping
        if settings.INFERENCE_MODE == "local_gpu":
            async with self._lock:
                def _run_sync():
                    import torch
                    self._ensure_local_gpu_loaded(
                        base_model.base_hf_repo,
                        base_model.adapter_name,
                        base_model.adapter_path,
                    )
                    inputs = self._tokenizer(formatted_prompt, return_tensors="pt").to(self._model.device)
                    prompt_len = inputs["input_ids"].shape[1]
                    with torch.no_grad():
                        outputs = self._model.generate(
                            **inputs,
                            max_new_tokens=max_new_tokens,
                            do_sample=temperature > 0.0,
                            temperature=max(temperature, 0.01),
                            pad_token_id=self._tokenizer.eos_token_id,
                        )
                    generated_ids = outputs[0][prompt_len:]
                    reply_text = self._tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
                    return reply_text, prompt_len, len(generated_ids)

                reply_text, prompt_tokens, completion_tokens = await asyncio.to_thread(_run_sync)
                latency_ms = int((time.perf_counter() - start) * 1000)
                return {
                    "reply": reply_text,
                    "latency_ms": latency_ms,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                }

        # Mode 3: mock_dev (CPU development mode — echoes grounded RAG retrieval cleanly)
        await asyncio.sleep(0.15)
        if context_passages:
            snippet = context_passages[0][:320].replace("\n", " ")
            reply = (
                f"[{base_model.name} • RAG Grounded]\n\n"
                f"Based on your connected knowledge base ({len(context_passages)} relevant passage(s) retrieved):\n"
                f"> \"{snippet}...\"\n\n"
                f"**Answer to '{user_query}':** The retrieved records indicate the above details apply directly to your request."
            )
        else:
            reply = (
                f"[{base_model.name} • Direct Mode]\n\n"
                f"Response to: **{user_query}**\n"
                f"(Tip: Attach documents or connect a database to ground this model on your private data.)"
            )

        latency_ms = int((time.perf_counter() - start) * 1000)
        return {
            "reply": reply,
            "latency_ms": latency_ms,
            "prompt_tokens": len(formatted_prompt) // 4,
            "completion_tokens": len(reply) // 4,
        }


model_engine = SkyBeakModelEngine()