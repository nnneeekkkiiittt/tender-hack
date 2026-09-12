"""
Модуль генерации ответов на основе извлеченного контекста (Generator).
Работает с Qwen 2.5 7B через OpenAI-совместимый API vLLM, поддерживает стриминг токенов.
"""

import json
import logging
import re
from typing import List, Dict, Optional, Iterator
import requests

from .config import settings
from .schemas import RetrievedChunk

logger = logging.getLogger(__name__)

GENERATOR_SYSTEM_PROMPT = """Ты — русскоязычный консультант службы поддержки Портала поставщиков.
Отвечай только на русском языке.
Используй только факты из предоставленного текста.
Дай понятный пошаговый ответ.
Если в тексте нет ответа на вопрос, ответь только: [NO_CONTEXT]"""


class AnswerGenerator:
    """Генератор ответов на базе Qwen 2.5 7B с защитой от галлюцинаций."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout: float = settings.REQUEST_TIMEOUT,
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
        """Собирает фрагменты базы знаний в чистый контекст без триггерных метаданных."""
        if not chunks:
            return "Нет подходящих документов."

        parts = []
        for i, chunk in enumerate(chunks, 1):
            parts.append(f"[{i}] {chunk.text.strip()}")

        return "\n\n".join(parts)

    def _prepare_messages(
        self, query: str, chunks: List[RetrievedChunk], history: Optional[List[Dict[str, str]]] = None
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

        user_content = (
            f"ИНФОРМАЦИЯ ИЗ ДОКУМЕНТАЦИИ:\n{context_str}\n\n"
            f"ВОПРОС ПОЛЬЗОВАТЕЛЯ: {query}\n\n"
            f"Инструкция на русском языке:"
        )
        messages.append({"role": "user", "content": user_content})

        return messages

    def generate(
        self, query: str, chunks: List[RetrievedChunk], history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Синхронная генерация ответа на запрос с фильтрацией деградации."""
        messages = self._prepare_messages(query, chunks, history)
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": False,
        }

        try:
            url = f"{self.base_url}/chat/completions"
            response = self.session.post(url, json=payload, headers=self._get_headers(), timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            raw_content = data["choices"][0]["message"]["content"].strip()

            # Обрезаем возможную деградацию в китайский язык
            chinese_match = re.search(r"[\u4e00-\u9fff]", raw_content)
            if chinese_match:
                logger.warning(f"Обнаружен иероглиф в ответе LLM на позиции {chinese_match.start()}, обрезаем")
                raw_content = raw_content[:chinese_match.start()].rstrip()
                if not raw_content:
                    return "[NO_CONTEXT]"

            return raw_content
        except Exception as e:
            logger.error(f"Ошибка вызова LLM генератора ({self.base_url}): {e}")
            raise RuntimeError("Generation service unavailable") from e

    def generate_stream(
        self, query: str, chunks: List[RetrievedChunk], history: Optional[List[Dict[str, str]]] = None
    ) -> Iterator[str]:
        """
        Потоковая генерация токенов (Server-Sent Events) для фронтенда.
        Возвращает итератор порций сгенерированного текста (дельта).
        Останавливает стрим при первой попытке деградации в иероглифы.
        """
        messages = self._prepare_messages(query, chunks, history)
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": True,
        }

        try:
            url = f"{self.base_url}/chat/completions"
            with self.session.post(
                url, json=payload, headers=self._get_headers(), stream=True, timeout=self.timeout
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
                                # Защита: если начались иероглифы, прекращаем генерацию
                                if re.search(r"[\u4e00-\u9fff]", delta):
                                    logger.warning("Обнаружен иероглиф в стриме LLM, останавливаем поток")
                                    break
                                yield delta
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Ошибка при стриминге LLM: {e}")
            raise RuntimeError("Generation service unavailable") from e
