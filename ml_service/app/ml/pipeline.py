"""
Главный оркестратор ML-пайплайна интеллектуальной поддержки (SupportMLPipeline).
Связывает Router -> Retriever -> Generator -> ContextCard без дублирующих вызовов.
"""

import logging
from typing import List, Dict, Optional, Tuple, Iterator

from .schemas import (
    SupportLine,
    ResolutionStatus,
    RouteDecision,
    RetrievedChunk,
    ContextCard,
    RAGResult,
)
from .router import IntentRouter
from .retriever import KBRetriever
from .generator import AnswerGenerator

logger = logging.getLogger(__name__)


class SupportMLPipeline:
    """Единый фасад для обработки обращений пользователей."""

    def __init__(
        self,
        router: Optional[IntentRouter] = None,
        retriever: Optional[KBRetriever] = None,
        generator: Optional[AnswerGenerator] = None,
    ):
        self.router = router or IntentRouter()
        self.retriever = retriever or KBRetriever()
        self.generator = generator or AnswerGenerator()

    def _build_context_card(
        self,
        query: str,
        route: RouteDecision,
        bot_answer: Optional[str] = None,
        chunks: Optional[List[RetrievedChunk]] = None,
        escalation_reason: Optional[str] = None,
    ) -> ContextCard:
        """Вспомогательный метод сборки карточки эскалации."""
        sources = []
        if chunks:
            sources = [
                {
                    "doc_name": c.doc_name,
                    "breadcrumb": c.breadcrumb,
                    "page": c.page,
                    "page_end": c.page_end,
                    "edition": c.edition,
                    "score": round(c.score, 3),
                }
                for c in chunks
            ]

        return ContextCard(
            user_query=query,
            classified_line=route.line,
            confidence=route.confidence,
            topic=route.topic,
            subtopic=route.subtopic,
            bot_answer=bot_answer,
            sources_found=sources,
            escalation_reason=escalation_reason,
        )

    def _create_out_of_scope_result(self, route: RouteDecision) -> RAGResult:
        return RAGResult(
            answer=(
                "Я консультант службы поддержки системы закупок и торгов. "
                "Я отвечаю на вопросы по регламентам, системным требованиям, процедурам подачи заявок "
                "и работе платформы. Пожалуйста, задайте вопрос по теме системы."
            ),
            status=ResolutionStatus.OUT_OF_SCOPE,
            route=route,
            citations=[],
            context_card=None,
        )

    def _create_l3_result(self, query: str, route: RouteDecision) -> RAGResult:
        card = self._build_context_card(
            query=query,
            route=route,
            bot_answer=None,
            chunks=None,
            escalation_reason="Зафиксирован технический инцидент / программная ошибка (L3)",
        )
        return RAGResult(
            answer=(
                "Зафиксирован технический сбой в работе подсистемы. "
                "Для решения требуется инженерная группа третьей линии поддержки (L3). "
                "Система передаст обращение в её очередь."
            ),
            status=ResolutionStatus.ESCALATED,
            route=route,
            citations=[],
            context_card=card,
        )

    def _create_no_context_result(self, query: str, route: RouteDecision) -> RAGResult:
        card = self._build_context_card(
            query=query,
            route=route,
            bot_answer=None,
            chunks=None,
            escalation_reason="Отсутствует релевантный контекст в базе знаний",
        )
        return RAGResult(
            answer=(
                f"К сожалению, в текущей документации нет точной информации по вашему вопросу. "
                f"Требуется помощь оператора линии {route.line.value} "
                f"для предметной консультации."
            ),
            status=ResolutionStatus.ESCALATED,
            route=route,
            citations=[],
            context_card=card,
        )

    def process(self, query: str, history: Optional[List[Dict[str, str]]] = None) -> RAGResult:
        """
        Полный синхронный цикл обработки вопроса:
        1. Роутинг интента (Router)
        2. Обработка OUT_OF_SCOPE (вежливый отказ)
        3. Обработка L3 (прямая эскалация инженерам без поиска)
        4. Поиск в базе знаний Qdrant (Retriever)
        5. Проверка наличия контекста (эскалация оператору при отсутствии данных)
        6. Генерация ответа через Qwen 2.5 (Generator) + сборка ContextCard
        """
        route = self.router.route(query, history)
        logger.info(f"Запрос маршрутизирован: линия={route.line}, уверенность={route.confidence:.2f}")

        # Ветка 1: Непрофильный вопрос
        if route.line == SupportLine.OUT_OF_SCOPE:
            return self._create_out_of_scope_result(route)

        # Ветка 2: Технический инцидент L3
        if route.line == SupportLine.L3:
            return self._create_l3_result(query, route)

        # Ветка 3: Поиск в базе знаний (L1 / L2)
        chunks: List[RetrievedChunk] = []
        if route.needs_rag:
            chunks = self.retriever.search(query, line=route.line)

        # Если контекст в базе не найден
        if not chunks:
            return self._create_no_context_result(query, route)

        # Ветка 4: Генерация ответа на основе найденных чанков
        answer = self.generator.generate(query, chunks, history)
        if answer.strip() == "[NO_CONTEXT]":
            return self._create_no_context_result(query, route)
        context_card = self._build_context_card(
            query=query, route=route, bot_answer=answer, chunks=chunks, escalation_reason=None
        )

        return RAGResult(
            answer=answer,
            status=ResolutionStatus.AUTO_RESOLVED,
            route=route,
            citations=chunks,
            context_card=context_card,
        )

    def process_stream_setup(
        self, query: str, history: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[Optional[Iterator[str]], RAGResult]:
        """
        Подготовка к стримингу ответа для FastAPI SSE эндпоинта.
        Исключает повторный вызов роутера.
        Возвращает:
        - (None, RAGResult) если ответ статичный (OUT_OF_SCOPE, L3 или нет документов в БЗ)
        - (stream_iterator, draft_rag_result) если запущен стриминг генерации
        """
        route = self.router.route(query, history)

        if route.line == SupportLine.OUT_OF_SCOPE:
            return None, self._create_out_of_scope_result(route)

        if route.line == SupportLine.L3:
            return None, self._create_l3_result(query, route)

        chunks = self.retriever.search(query, line=route.line)
        if not chunks:
            return None, self._create_no_context_result(query, route)

        stream = self.generator.generate_stream(query, chunks, history)

        draft_card = self._build_context_card(query=query, route=route, bot_answer="", chunks=chunks)

        draft_result = RAGResult(
            answer="",
            status=ResolutionStatus.AUTO_RESOLVED,
            route=route,
            citations=chunks,
            context_card=draft_card,
        )

        return stream, draft_result
