"""
Модуль классификации интентов и маршрутизации обращений (Router).
Определяет целевую линию поддержки (L1, L2, L3, OUT_OF_SCOPE) через Qwen 2.5 7B.
"""

import json
import logging
import re
from typing import Optional, List, Dict
import requests

from .config import settings
from .schemas import SupportLine, RouteDecision

logger = logging.getLogger(__name__)

ROUTER_SYSTEM_PROMPT = """Ты — интеллектуальный диспетчер службы поддержки системы электронных закупок и торгов.

Твоя задача — классифицировать входящее обращение пользователя по 4 категориям:

1. "OUT_OF_SCOPE": Вопрос не относится к закупкам, регламентам, ИТ или поддержке (быт, кулинария, погода, спам, оффтоп).
2. "L1": Простые типовые вопросы (восстановление пароля, регистрация, вход, где скачать форму, базовая навигация в личном кабинете).
3. "L2": Методология, нормативные регламенты, ГОСТы, ФЗ о закупках, требования к СКЗИ/АРМ, сроки процедур. Требует базы знаний.
4. "L3": Программные инциденты и технические ошибки (код 500, Database Error, белый экран, ошибки ЭЦП, падение сервиса). Требует прямой передачи разработчикам без поиска в БЗ.

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В ФОРМАТЕ JSON:
{
  "line": "L1" | "L2" | "L3" | "OUT_OF_SCOPE",
  "confidence": число от 0.0 до 1.0,
  "topic": "краткое наименование темы",
  "subtopic": "подтема или null",
  "reasoning": "краткое объяснение в 1 предложение",
  "needs_rag": true для L1 и L2, false для L3 и OUT_OF_SCOPE
}
Не пиши ничего, кроме валидного JSON!

ВАЖНО: выбирай L3 только если пользователь сообщает о конкретном программном сбое, сообщении об ошибке или неработоспособности системы. Не придумывай инцидент по названию темы. Вопросы «как» или «где» выполнить штатное действие (в том числе загрузить документ/МЧД или использовать электронную подпись) без сообщения о сбое относятся к L1 и требуют поиска инструкции. Нормативные требования к этим действиям относятся к L2. Техническая терминология сама по себе не основание для L3.
"""


class IntentRouter:
    """Классификатор обращений на базе Qwen 2.5 7B с сохранением сессии."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: float = 60.0,
    ):
        self.base_url = (base_url or settings.VLLM_BASE_URL).rstrip("/")
        self.model_name = model_name or settings.MODEL_NAME
        self.timeout = timeout
        self.session = requests.Session()

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.VLLM_API_KEY and settings.VLLM_API_KEY != "EMPTY":
            headers["Authorization"] = f"Bearer {settings.VLLM_API_KEY}"
        return headers

    def route(self, query: str, history: Optional[List[Dict[str, str]]] = None) -> RouteDecision:
        """
        Классифицирует вопрос пользователя.
        В случае сбоя инференса или некорректного ответа возвращает надежный fallback.
        """
        messages = [{"role": "system", "content": ROUTER_SYSTEM_PROMPT}]

        if history:
            for msg in history[-3:]:
                role = "assistant" if msg.get("role") in ("assistant", "bot") else "user"
                content = msg.get("content", "").strip()
                if content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": query})

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": settings.ROUTER_TEMPERATURE,
            "max_tokens": 250,
            "response_format": {"type": "json_object"},
        }

        try:
            url = f"{self.base_url}/chat/completions"
            response = self.session.post(url, json=payload, headers=self._get_headers(), timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            if content.startswith('```'):
                content = re.sub(r'^```(?:json)?\s*', '', content)
                content = re.sub(r'\s*```$', '', content)
            parsed = json.loads(content)

            # Валидация линии через enum без приватных атрибутов
            raw_line = str(parsed.get("line", "L1")).upper().strip()
            try:
                line_enum = SupportLine(raw_line)
            except ValueError:
                logger.warning(f"Неизвестная линия поддержки '{raw_line}', fallback на L1")
                line_enum = SupportLine.L1

            needs_rag = line_enum in (SupportLine.L1, SupportLine.L2)

            return RouteDecision(
                line=line_enum,
                confidence=max(0.0, min(1.0, float(parsed.get("confidence", 0.9)))),
                topic=str(parsed.get("topic", "Общие вопросы")),
                subtopic=parsed.get("subtopic"),
                reasoning=str(parsed.get("reasoning", "")),
                needs_rag=needs_rag,
            )

        except Exception as e:
            logger.warning(f"Ошибка вызова LLM роутера ({e}). Сработал эвристический классификатор.")
            return self._heuristic_fallback(query)

    def _heuristic_fallback(self, query: str) -> RouteDecision:
        """Резервный эвристический классификатор."""
        q_lower = query.lower()

        # L3: Технические инциденты
        l3_keywords = [
            "500",
            "error",
            "ошибка сервера",
            "упал",
            "exception",
            "traceback",
            "не работает сайт",
            "crash",
            "баг",
        ]
        if any(k in q_lower for k in l3_keywords):
            return RouteDecision(
                line=SupportLine.L3,
                confidence=0.75,
                topic="Технический инцидент",
                reasoning="Сработал эвристический детектор технических сбоев",
                needs_rag=False,
            )

        # OUT_OF_SCOPE: Непрофильные темы
        out_keywords = [
            "рецепт",
            "погода",
            "анекдот",
            "стих",
            "фильм",
            "пирог",
            "гороскоп",
            "песня",
            "привет как дела",
        ]
        if any(k in q_lower for k in out_keywords):
            return RouteDecision(
                line=SupportLine.OUT_OF_SCOPE,
                confidence=0.8,
                topic="Вне контекста системы",
                reasoning="Сработал эвристический фильтр непрофильных запросов",
                needs_rag=False,
            )

        # L2: Нормативка и регламенты
        l2_keywords = [
            "гост",
            "регламент",
            "фз-",
            "закон",
            "скзи",
            "арм",
            "криптопро",
            "требован",
            "положен",
            "статья",
            "пункт",
            "закупк",
        ]
        if any(k in q_lower for k in l2_keywords):
            return RouteDecision(
                line=SupportLine.L2,
                confidence=0.7,
                topic="Нормативные требования",
                reasoning="Запрос содержит нормативную терминологию",
                needs_rag=True,
            )

        # L1: По умолчанию
        return RouteDecision(
            line=SupportLine.L1,
            confidence=0.6,
            topic="Общий вопрос",
            reasoning="Маршрутизация по умолчанию на первую линию поддержки",
            needs_rag=True,
        )
