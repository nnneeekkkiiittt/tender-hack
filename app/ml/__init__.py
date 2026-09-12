"""
ML Core пакет системы интеллектуальной поддержки.
Включает роутер, ретривер, генератор и оркестратор RAG-пайплайна.
"""

from .config import settings
from .schemas import (
    SupportLine,
    RouteDecision,
    RetrievedChunk,
    RAGResult,
    ContextCard,
)
from .router import IntentRouter
from .retriever import KBRetriever
from .generator import AnswerGenerator
from .pipeline import SupportMLPipeline

__all__ = [
    "settings",
    "SupportLine",
    "RouteDecision",
    "RetrievedChunk",
    "RAGResult",
    "ContextCard",
    "IntentRouter",
    "KBRetriever",
    "AnswerGenerator",
    "SupportMLPipeline",
]
