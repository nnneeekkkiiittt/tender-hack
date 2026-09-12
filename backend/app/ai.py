"""Interchangeable, stateless AI implementations. No claim/database dependencies."""

import logging
from typing import Protocol

import httpx

from .models import AiAnswer


class AiService(Protocol):
    def ask(self, question: str) -> AiAnswer: ...


class AiServiceError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


class MockAiService:
    def ask(self, question: str) -> AiAnswer:
        return AiAnswer(
            answer=(
                "Демонстрационный ответ (Mock AI).\n\n"
                f"Ваш вопрос: {question}\n\n"
                "Это тестовая заглушка: модель и поиск по документации не вызываются. "
                "Нажмите «Не помогло» или напишите ещё — поддержка L1 продолжит этот чат."
            ),
            sources=[],
        )


class HttpAiService:
    def __init__(self, client: httpx.Client, url: str, api_key: str = ""):
        self.client = client
        self.url = url
        self.api_key = api_key

    def ask(self, question: str) -> AiAnswer:
        if not self.url:
            raise AiServiceError(
                503, "AI service is not configured. Send a follow-up to reach support in this chat."
            )
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        try:
            with self.client.stream(
                "POST", self.url, json={"question": question}, headers=headers
            ) as response:
                response.raise_for_status()
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > 131072:
                        raise ValueError("Oversized AI response")
                    chunks.append(chunk)
                return AiAnswer.model_validate_json(b"".join(chunks))
        except httpx.TimeoutException:
            raise AiServiceError(
                504, "AI service timed out. Send a follow-up to reach support in this chat."
            ) from None
        except (httpx.HTTPError, ValueError):
            logging.getLogger(__name__).warning("AI request failed (upstream details omitted)")
            raise AiServiceError(
                502, "AI service unavailable. Send a follow-up to reach support in this chat."
            ) from None
