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

GENERATOR_SYSTEM_PROMPT = """Ты — эксперт службы поддержки Портала поставщиков Москвы.
Отвечай структурированно, грамотно и только на русском языке.
Правила ответа:
1. Используй факты из предоставленного текста регламентов и инструкций.
2. Отвечай простым текстом без markdown разметки: НЕ используй звёздочки **, решётки #, нижние подчёркивания _. Для пунктов используй обычную нумерацию: 1., 2., 3. и дефисы для подпунктов: -.
3. НЕ упоминай номера рисунков, схем, иллюстраций и таблиц (например, не пиши «(Рисунок 123)»), так как пользователь их не видит в чате.
4. Если вопрос общий (например, о документах, регистрации, участии в закупках, электронной подписи), обобщи правила и требования в виде четкого понятного списка шагов или пунктов.
5. Если вопрос про конкретную ошибку интерфейса, назови точное действие (какую кнопку нажать, что обновить).
6. Не выдумывай факты, которых нет в регламентах.
7. Напиши [NO_CONTEXT] только в том случае, если предоставленный текст вообще никак не относится к вопросу пользователя."""


def clean_text(text: str) -> str:
    """Очищает текст от упоминаний рисунков/таблиц, markdown-звёздочек и артефактов PDF."""
    if not text:
        return text

    # 1. Удаляем упоминания рисунков и таблиц (включая вложенные скобки типа (Рисунок 545 (3)))
    text = re.sub(r"\s*\([сС]м\.?\s*Рисунок(?:\([^)]*\)|[^)])*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\(Рисунок(?:\([^)]*\)|[^)])*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\(Таблиц[а-яА-ЯёЁa-zA-Z0-9\s;–—\-_:]*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Рисунок\s+\d+[^–—\n]*[–—\-][^\n]*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Таблица\s+\d+[^–—\n]*[–—\-][^\n]*", "", text, flags=re.IGNORECASE)

    # 2. Удаляем markdown разметку (**жирный**, *курсив*, ### заголовки) для чистого Plain Text в чате
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"(?m)^#{1,6}\s*", "", text)

    # 3. Чистим артефакты PDF: версии документов, лишние точки, повторяющиеся пробелы
    text = re.sub(r"\b\d{2}\.\d{2}\.\d{4}v\d+\b", "", text)
    text = re.sub(r"\.{2,}", ".", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_action_for_error(query: str, chunks: List[RetrievedChunk]) -> Optional[str]:
    """Извлекает точное действие из регламента для указанного кода ошибки."""
    code_matches = re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]+_\d+", query)
    if not code_matches:
        return None
    code = code_matches[0]
    code_lower = code.lower()
    for chunk in chunks:
        if code_lower in chunk.text.lower():
            for sent in re.split(r"[\n.]+", chunk.text):
                if code_lower in sent.lower():
                    parts = re.split(r"[–—\-]\s*", sent)
                    action = parts[-1].strip() if len(parts) > 1 else sent.strip()
                    action = clean_text(action)
                    action = re.sub(r"^(требуется|необходимо)\s+", "", action, flags=re.IGNORECASE).strip()
                    if any(
                        act in action.lower()
                        for act in ("нажать", "кнопк", "обновить", "перейти", "заполнить", "создайте", "обратитесь")
                    ):
                        return f"При возникновении ошибки {code} требуется {action}."
    return None


class AnswerGenerator:
    """Генератор ответов на базе Qwen с защитой от галлюцинаций."""

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
        """Собирает фрагменты базы знаний в чистый контекст без артефактов и ссылок на рисунки."""
        if not chunks:
            return "Нет подходящих документов."

        parts = []
        for i, chunk in enumerate(chunks, 1):
            cleaned = re.sub(r"\s*\([сС]м\.?\s*Рисунок(?:\([^)]*\)|[^)])*\)", "", chunk.text, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*\(Рисунок(?:\([^)]*\)|[^)])*\)", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"Рисунок\s+\d+[^–—\n]*[–—\-][^\n]*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\b\d{2}\.\d{2}\.\d{4}v\d+\b", "", cleaned)
            parts.append(f"[{i}] {cleaned.strip()}")

        return "\n\n".join(parts)

    def _prepare_messages(
        self, query: str, chunks: List[RetrievedChunk], history: Optional[List[Dict[str, str]]] = None
    ) -> List[Dict[str, str]]:
        """Формирует цепочку сообщений для чат-инференса."""
        # Если в запросе есть конкретный код ошибки, фокусируем контекст только на чанках с этим кодом
        code_matches = re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]+_\d+", query)
        focused_chunks = chunks
        if code_matches:
            target_code = code_matches[0].lower()
            matching = [c for c in chunks if target_code in c.text.lower()]
            if matching:
                focused_chunks = matching

        context_str = self._build_context_prompt(focused_chunks)

        messages = [
            {"role": "system", "content": GENERATOR_SYSTEM_PROMPT},
        ]

        if history:
            for msg in history[-4:]:
                role = "assistant" if msg.get("role") in ("assistant", "bot") else "user"
                content = msg.get("content", "").strip()
                if content:
                    messages.append({"role": role, "content": content})

        if code_matches:
            user_content = (
                f"ДОКУМЕНТАЦИЯ:\n{context_str}\n\n"
                f"ОШИБКА: {query}\n\n"
                f"Напиши конкретное действие для решения этой ошибки (какую кнопку нажать или что сделать):"
            )
        else:
            user_content = (
                f"ДОКУМЕНТАЦИЯ:\n{context_str}\n\n"
                f"ВОПРОС ПОЛЬЗОВАТЕЛЯ: {query}\n\n"
                f"Инструкция на русском языке:"
            )
        messages.append({"role": "user", "content": user_content})

        return messages

    def generate(
        self, query: str, chunks: List[RetrievedChunk], history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Синхронная генерация ответа на запрос с защитой от деградации."""
        # Для запросов с точными кодами ошибок проверяем прямое извлечение регламентного действия
        extracted_action = extract_action_for_error(query, chunks)

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

            # Проверяем деградацию в китайский язык
            chinese_match = re.search(r"[\u4e00-\u9fff]", raw_content)
            if chinese_match:
                logger.warning(f"Обнаружен иероглиф в ответе LLM на позиции {chinese_match.start()}, обрезаем")
                raw_content = raw_content[:chinese_match.start()].rstrip()

            # Если ответ оборван или ошибочно утверждает, что ошибка не описана
            is_broken = (
                len(raw_content) < 30
                or any(raw_content.endswith(p) for p in (" в", " на", " по", " для", " к", " с", " от", " не"))
                or "не описана" in raw_content.lower()
            )
            if is_broken and extracted_action:
                return clean_text(extracted_action)

            if not raw_content:
                return clean_text(extracted_action) if extracted_action else "[NO_CONTEXT]"

            if raw_content == "[NO_CONTEXT]":
                return "[NO_CONTEXT]"

            return clean_text(raw_content)
        except Exception as e:
            if extracted_action:
                logger.info(f"LLM недоступна, возвращаем извлеченное действие: {extracted_action}")
                return extracted_action
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
        extracted_action = extract_action_for_error(query, chunks)
        if extracted_action and re.findall(r"[а-яА-ЯёЁa-zA-Z0-9_-]+_\d+", query):
            # Если это точный код ошибки с готовым регламентным ответом, отдаем его надежно
            yield extracted_action
            return

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
                                if re.search(r"[\u4e00-\u9fff]", delta):
                                    logger.warning("Обнаружен иероглиф в стриме LLM, останавливаем поток")
                                    break
                                yield delta
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            if extracted_action:
                yield extracted_action
                return
            logger.error(f"Ошибка при стриминге LLM: {e}")
            raise RuntimeError("Generation service unavailable") from e
