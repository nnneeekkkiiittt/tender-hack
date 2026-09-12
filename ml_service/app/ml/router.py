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

ROUTER_SYSTEM_PROMPT = """Ты — диспетчер службы поддержки системы электронных закупок.
Классифицируй обращение пользователя по одной из 3 категорий:

1. "L1" (Базовые вопросы):
   Навигация по интерфейсу (где кнопка/раздел), учетная запись (вход, регистрация, смена пароля), общие контакты и простые типовые действия.

2. "L2" (Системные вопросы и сбои):
   Электронная подпись (ЭЦП, КриптоПро), заполнение документов (оферты, СТЕ, акты), регламенты и сроки процедур, МЧД, YML, а также любые сообщения о технических сбоях и ошибках (код 500, белый экран, не открывается страница).

3. "OUT_OF_SCOPE" (Непрофильные темы):
   Вопросы не по теме площадки закупок (быт, кулинария, погода, анекдоты, спам).

ПРИМЕРЫ:
- "Как сбросить пароль от личного кабинета?" -> {"line": "L1", "topic": "Сброс пароля"}
- "Где посмотреть раздел Мои закупки?" -> {"line": "L1", "topic": "Навигация в кабинете"}
- "Не работает электронная подпись при подписании оферты" -> {"line": "L2", "topic": "Ошибка ЭЦП"}
- "Как заполнить спецификацию при создании позиции СТЕ?" -> {"line": "L2", "topic": "Заполнение СТЕ"}
- "Ошибка 500 Internal Server Error при сохранении" -> {"line": "L2", "topic": "Ошибка 500"}
- "Как приготовить шарлотку с яблоками?" -> {"line": "OUT_OF_SCOPE", "topic": "Не по теме"}

ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В ФОРМАТЕ JSON (БЕЗ РАЗМЕТКИ MARKDOWN, ТОЛЬКО ОБЪЕКТ):
{"line": "L1" | "L2" | "OUT_OF_SCOPE", "topic": "краткая тема (2-3 слова)"}"""


class IntentRouter:
    """Классификатор обращений на базе Qwen с сохранением сессии."""

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
            "max_tokens": 30,
            "response_format": {"type": "json_object"},
        }

        try:
            url = f"{self.base_url}/chat/completions"
            response = self.session.post(url, json=payload, headers=self._get_headers(), timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Очистка markdown fences, если модель их вернула
            if content.startswith("```"):
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)

            parsed = json.loads(content)

            # Валидация линии через enum
            raw_line = str(parsed.get("line", "L1")).upper().strip()
            try:
                line_enum = SupportLine(raw_line)
            except ValueError:
                logger.warning(f"Неизвестная линия поддержки '{raw_line}', fallback на L1")
                line_enum = SupportLine.L1

            # Предохранитель: прямая маршрутизация на L3 запрещена, перенаправляем на L2
            if line_enum == SupportLine.L3:
                line_enum = SupportLine.L2

            needs_rag = line_enum in (SupportLine.L1, SupportLine.L2)

            return RouteDecision(
                line=line_enum,
                confidence=float(parsed.get("confidence", 1.0)),
                topic=str(parsed.get("topic", "Общие вопросы")),
                subtopic=None,
                reasoning="",
                needs_rag=needs_rag,
            )

        except Exception as e:
            logger.warning(f"Ошибка вызова LLM роутера ({e}). Сработал эвристический классификатор.")
            return self._heuristic_fallback(query)

    def _heuristic_fallback(self, query: str) -> RouteDecision:
        """Резервный эвристический классификатор."""
        q_lower = query.lower()

        # OUT_OF_SCOPE: Непрофильные темы
        out_keywords = [
            "рецепт",
            "погода",
            "анекдот",
            "стих",
            "фильм",
            "пирог",
            "шарлотк",
            "гороскоп",
            "песня",
            "привет как дела",
        ]
        if any(k in q_lower for k in out_keywords):
            return RouteDecision(
                line=SupportLine.OUT_OF_SCOPE,
                confidence=0.85,
                topic="Вне контекста системы",
                reasoning="Сработал эвристический фильтр непрофильных запросов",
                needs_rag=False,
            )

        # L2: Технические сбои, ошибки сервера, ЭЦП, документы и регламенты
        l2_keywords = [
            # Технические проблемы и сбои
            "500",
            "502",
            "504",
            "ошибка сервера",
            "internal server error",
            "упал сервер",
            "упала база",
            "database error",
            "database connection",
            "traceback",
            "белый экран",
            "сайт упал",
            "сервер упал",
            "exception",
            "crash",
            "завис",
            "не нажимается",
            "не открывается",
            # ЭЦП, криптография, документы, регламенты
            "эцп",
            "подпис",
            "сертификат",
            "криптопро",
            "плагин",
            "заполн",
            "оферт",
            "сте",
            "мчд",
            "доверенност",
            "регламент",
            "гост",
            "фз-",
            "закон",
            "скзи",
            "арм",
            "требован",
            "положен",
            "статья",
            "пункт",
            "закупк",
            "акт",
            "контракт",
        ]
        if any(k in q_lower for k in l2_keywords):
            return RouteDecision(
                line=SupportLine.L2,
                confidence=0.75,
                topic="Вопросы по работе в системе и регламентам",
                reasoning="Запрос относится к работе с документами, ЭЦП, регламентами или сбоям",
                needs_rag=True,
            )

        # L1: Базовые типовые вопросы по умолчанию
        return RouteDecision(
            line=SupportLine.L1,
            confidence=0.6,
            topic="Базовый вопрос",
            reasoning="Маршрутизация по умолчанию на первую линию поддержки",
            needs_rag=True,
        )

