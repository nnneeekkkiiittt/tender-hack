"""
Модуль классификации интентов и маршрутизации обращений (Router).
Определяет целевую линию поддержки (L1, L2, L3, OUT_OF_SCOPE) через LLM.
"""

import json
import logging
import re
from typing import Optional, List, Dict
import requests

from .config import settings
from .schemas import SupportLine, RouteDecision

logger = logging.getLogger(__name__)

ROUTER_SYSTEM_PROMPT = """Ты — классификатор службы поддержки Портала поставщиков и госзакупок.

Классифицируй запрос пользователя строго по 4 категориям:
1. "OUT_OF_SCOPE": Не относится к закупкам и порталу (быт, кулинария, погода, спам, оффтоп).
2. "L1": Базовые типовые вопросы: вход, регистрация, восстановление пароля, навигация по сайту.
3. "L2": Предметные вопросы по закупкам, регламентам, документам (оферты, контракты, СТЕ, МЧД, ЭЦП) и ЛЮБЫЕ ошибки интерфейса и коды ошибок (включая РДИК, валидацию).
4. "L3": ИСКЛЮЧИТЕЛЬНО падение всей серверной инфраструктуры (код HTTP 500, упал сервер или база данных).

Ответь СТРОГО в формате JSON без markdown:
{"line": "L1" | "L2" | "L3" | "OUT_OF_SCOPE", "topic": "тема (2-3 слова)"}"""


class IntentRouter:
    """Классификатор обращений на базе LLM с минимальным latency и защитой."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: float = 30.0,
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
            "max_tokens": 50,
            "response_format": {"type": "json_object"},
        }

        try:
            url = f"{self.base_url}/chat/completions"
            response = self.session.post(url, json=payload, headers=self._get_headers(), timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Очистка markdown fences, если модель вернула код-блок
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

            # Защита от ложного L3: ошибки РДИК, оферт, ЭЦП, валидации — всегда L2
            q_lower = query.lower()
            if line_enum == SupportLine.L3 and (
                "рдик" in q_lower
                or "оферт" in q_lower
                or "сте" in q_lower
                or "эцп" in q_lower
                or "подпис" in q_lower
                or "документ" in q_lower
            ):
                logger.info(f"Запрос '{query}' перенаправлен с L3 на L2 (ошибка бизнес-логики/портала)")
                line_enum = SupportLine.L2

            needs_rag = line_enum in (SupportLine.L1, SupportLine.L2)

            return RouteDecision(
                line=line_enum,
                confidence=max(0.0, min(1.0, float(parsed.get("confidence", 1.0)))),
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

        # L3: Только критические сбои инфраструктуры (500, crash, упал сервер)
        l3_keywords = [
            "500",
            "internal server error",
            "упал сервер",
            "упала база",
            "сервер упал",
            "база упала",
            "traceback",
        ]
        if any(k in q_lower for k in l3_keywords) and "рдик" not in q_lower:
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

        # L2: Технические сбои интерфейса, коды ошибок (РДИК), ЭЦП, документы и регламенты
        l2_keywords = [
            "рдик",
            "ошибка",
            "error",
            "код ошибки",
            "exception",
            "crash",
            "завис",
            "не нажимается",
            "не открывается",
            "баг",
            "белый экран",
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
                reasoning="Запрос относится к работе с документами, ЭЦП, регламентами или сбоям интерфейса",
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
