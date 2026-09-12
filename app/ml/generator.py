"""
Модуль генерации ответов на основе извлеченного контекста (Generator).
Работает с Qwen 2.5 7B через OpenAI-совместимый API vLLM, поддерживает стриминг токенов.
"""

import json
import logging
from typing import List, Dict, Optional, Iterator
import requests

from .config import settings
from .schemas import RetrievedChunk

logger = logging.getLogger(__name__)

GENERATOR_SYSTEM_PROMPT = """Ты — квалифицированный консультант службы технической и методологической поддержки системы электронных торгов и закупок.

Твоя задача — предоставить исчерпывающий, профессиональный и вежливый ответ на вопрос пользователя СТРОГО на основе приведенных официальных фрагментов базы знаний (контекста).

ПРАВИЛА И ОГРАНИЧЕНИЯ:
1. Запрещены любые домысливания и галлюцинации. Опирайся исключительно на факты, пункты регламентов, параметры таблиц и требования из контекста.
2. Если в предоставленном контексте нет достаточной информации для однозначного ответа, прямо и честно сообщи: "В доступной документации не содержится точной информации по данному вопросу. Я могу перевести обращение на профильного оператора поддержки."
3. Излагай информацию структурированно: используй списки, выделяй ключевые требования жирным шрифтом.
4. В самом конце ответа обязательно приведи блок с указанием источников:
   **Использованные источники:**
   - [Имя документа] > [Раздел/Пункт] (Страница X)
"""


class AnswerGenerator:
    """Генератор ответов на базе Qwen 2.5 7B с защитой от галлюцинаций."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout: float = 60.0
    ):
        self.base_url = (base_url or settings.VLLM_BASE_URL).rstrip("/")
        self.model_name = model_name or settings.MODEL_NAME
        self.temperature = temperature if temperature is not None else settings.GENERATOR_TEMPERATURE
        self.max_tokens = max_tokens or settings.MAX_TOKENS_GENERATOR
        self.timeout = timeout
        self.session = requests.Session()

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.VLLM_API_KEY and settings.VLLM_API_KEY != "EMPTY":
            headers["Authorization"] = f"Bearer {settings.VLLM_API_KEY}"
        return headers

    def _build_context_prompt(self, chunks: List[RetrievedChunk]) -> str:
        """Собирает фрагменты базы знаний в единый структурированный контекст."""
        if not chunks:
            return "Фрагменты базы знаний: не найдено подходящих документов."

        parts = []
        for i, chunk in enumerate(chunks, 1):
            page_info = f", Страница {chunk.page}" if chunk.page else ""
            header = f"=== ФРАГМЕНТ #{i} ===\nДокумент: {chunk.doc_name}\nРаздел: {chunk.breadcrumb}{page_info}\n"
            parts.append(f"{header}\n{chunk.text.strip()}\n")

        return "ОФИЦИАЛЬНЫЙ КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ:\n\n" + "\n".join(parts)

    def _prepare_messages(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        history: Optional[List[Dict[str, str]]] = None
    ) -> List[Dict[str, str]]:
        """Формирует цепочку сообщений для чат-инференса."""
        context_str = self._build_context_prompt(chunks)

        messages = [
            {"role": "system", "content": GENERATOR_SYSTEM_PROMPT},
        ]

        if history:
            for msg in history[-4:]:
                role = "assistant" if msg.get("role") in ("assistant", "bot") else "user"
                content = msg.get("content", "").strip()
                if content:
                    messages.append({"role": role, "content": content})

        user_content = f"{context_str}\n\nВОПРОС ПОЛЬЗОВАТЕЛЯ:\n{query}"
        messages.append({"role": "user", "content": user_content})

        return messages

    def generate(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Синхронная генерация ответа на запрос."""
        messages = self._prepare_messages(query, chunks, history)
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": False
        }

        try:
            url = f"{self.base_url}/chat/completions"
            response = self.session.post(
                url,
                json=payload,
                headers=self._get_headers(),
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Ошибка вызова LLM генератора ({self.base_url}): {e}")
            return (
                "Извините, в данный момент возникли технические сложности при формировании ответа. "
                "Ваш вопрос зарегистрирован и передается специалисту поддержки."
            )

    def generate_stream(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        history: Optional[List[Dict[str, str]]] = None
    ) -> Iterator[str]:
        """
        Потоковая генерация токенов (Server-Sent Events) для фронтенда.
        Возвращает итератор порций сгенерированного текста (дельта).
        """
        messages = self._prepare_messages(query, chunks, history)
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": True
        }

        try:
            url = f"{self.base_url}/chat/completions"
            with self.session.post(
                url,
                json=payload,
                headers=self._get_headers(),
                stream=True,
                timeout=self.timeout
            ) as r:
                r.raise_for_status()
                for line in r.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk_data = json.loads(data_str)
                            delta = chunk_data["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Ошибка при стриминге LLM: {e}")
            yield "Произошла ошибка при обращении к языковой модели."
