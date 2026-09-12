"""
Pydantic схемы данных для ML-ядра системы поддержки.
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class SupportLine(str, Enum):
    L1 = "L1"  # Первая линия: типовые вопросы, FAQ
    L2 = "L2"  # Вторая линия: регламенты, методология, нормативка
    L3 = "L3"  # Третья линия: тех. сбои, 500 ошибки, баги, БД
    OUT_OF_SCOPE = "OUT_OF_SCOPE"  # Вне контекста: бытовые темы, спам, оффтоп


class ResolutionStatus(str, Enum):
    AUTO_RESOLVED = "AUTO_RESOLVED"  # Успешный авто-ответ бота
    ESCALATED = "ESCALATED"  # Эскалировано человеку (L1/L2/L3)
    OUT_OF_SCOPE = "OUT_OF_SCOPE"  # Отказ (не относится к системе)


class RouteDecision(BaseModel):
    """Результат классификации интента пользователя."""

    line: SupportLine = Field(description="Целевая линия поддержки")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Уверенность классификатора от 0 до 1")
    topic: str = Field(default="Общее", description="Категория/тема запроса")
    subtopic: Optional[str] = Field(default=None, description="Подтема или подраздел")
    reasoning: str = Field(default="", description="Краткое объяснение выбора маршрута")
    needs_rag: bool = Field(default=True, description="Требуется ли поиск по базе знаний")


class RetrievedChunk(BaseModel):
    """Фрагмент документа из базы знаний Qdrant."""

    text: str = Field(description="Текст фрагмента")
    doc_name: str = Field(description="Имя документа источника")
    breadcrumb: str = Field(default="", description="Иерархия заголовков (Раздел > Подраздел)")
    page: Optional[int] = Field(default=None, description="Номер страницы в оригинальном PDF")
    page_end: Optional[int] = None
    edition: Optional[str] = None
    score: float = Field(default=0.0, description="Косинусная близость (релевантность)")
    support_line: str = Field(default="L2", description="Линия БЗ, к которой относится чанк")


class ContextCard(BaseModel):
    """Контекстная карточка обращения, передаваемая оператору при эскалации."""

    user_query: str = Field(description="Исходный вопрос пользователя")
    classified_line: SupportLine = Field(description="Определенная линия")
    confidence: float = Field(description="Уверенность классификации")
    topic: str = Field(description="Тема обращения")
    subtopic: Optional[str] = Field(default=None, description="Подтема")
    bot_answer: Optional[str] = Field(default=None, description="Сгенерированный ботом ответ (если был)")
    sources_found: List[Dict[str, Any]] = Field(
        default_factory=list, description="Использованные фрагменты БЗ"
    )
    escalation_reason: Optional[str] = Field(
        default=None, description="Причина эскалации (дизлайк / нет в БЗ / L3 инцидент)"
    )


class RAGResult(BaseModel):
    """Итоговый результат работы ML-пайплайна."""

    answer: str = Field(description="Текст ответа для пользователя")
    status: ResolutionStatus = Field(description="Статус завершения")
    route: RouteDecision = Field(description="Информация о маршрутизации")
    citations: List[RetrievedChunk] = Field(default_factory=list, description="Цитируемые источники")
    context_card: Optional[ContextCard] = Field(default=None, description="Карточка эскалации для оператора")
