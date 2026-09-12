"""
Конфигурация параметров ML-ядра и внешних сервисов инференса.
"""

import os
from dataclasses import dataclass, field

# Гарантируем, что локальные сервисы Docker (Qdrant, TEI, vLLM) не заворачиваются в системный прокси
_curr_no_proxy = os.environ.get("NO_PROXY", "")
os.environ["NO_PROXY"] = (
    f"{_curr_no_proxy},localhost,127.0.0.1,0.0.0.0,qdrant,tei,ml,host.docker.internal".strip(",")
)
os.environ["no_proxy"] = os.environ["NO_PROXY"]


@dataclass
class MLSettings:
    # vLLM / OpenAI-совместимый LLM сервер (Qwen 2.5 7B Instruct)
    VLLM_BASE_URL: str = field(default_factory=lambda: os.getenv("VLLM_BASE_URL", "http://localhost:8000/v1"))
    VLLM_API_KEY: str = field(default_factory=lambda: os.getenv("VLLM_API_KEY", "EMPTY"))
    MODEL_NAME: str = field(default_factory=lambda: os.getenv("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct-AWQ"))

    # TEI / Сервер эмбеддингов (bge-m3)
    TEI_BASE_URL: str = field(default_factory=lambda: os.getenv("TEI_BASE_URL", "http://localhost:8080"))

    # Qdrant Vector DB
    QDRANT_URL: str = field(default_factory=lambda: os.getenv("QDRANT_URL", "http://localhost:6333"))
    QDRANT_API_KEY: str = field(default_factory=lambda: os.getenv("QDRANT_API_KEY", ""))

    # Имена коллекций в Qdrant
    COLLECTION_L1: str = field(default_factory=lambda: os.getenv("COLLECTION_L1", "kb_l1"))
    COLLECTION_L2: str = field(default_factory=lambda: os.getenv("COLLECTION_L2", "kb_support"))

    # Параметры поиска и пороги отсечения
    TOP_K: int = field(default_factory=lambda: int(os.getenv("TOP_K", "4")))
    SCORE_THRESHOLD: float = field(default_factory=lambda: float(os.getenv("SCORE_THRESHOLD", "0.50")))

    # Параметры генерации
    ROUTER_TEMPERATURE: float = 0.0
    GENERATOR_TEMPERATURE: float = 0.1
    MAX_TOKENS_GENERATOR: int = 512
    REQUEST_TIMEOUT: float = field(default_factory=lambda: float(os.getenv("REQUEST_TIMEOUT", "120")))
    EMBEDDING_PREFIX: str = field(default_factory=lambda: os.getenv("EMBEDDING_PREFIX", ""))


settings = MLSettings()
