from typing import Literal, Protocol

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError, model_validator


class ModerationUnavailable(Exception):
    pass


class Decision(BaseModel):
    decision: Literal['ALLOW', 'BLOCK']
    reason: Literal['OBSCENITY'] | None
    policy_version: str = Field(min_length=1, max_length=64)

    @model_validator(mode='after')
    def consistent(self):
        if (self.decision == 'BLOCK') != (self.reason == 'OBSCENITY'):
            raise ValueError('Inconsistent moderation decision')
        return self


class ModerationService(Protocol):
    def check(self, text: str) -> Decision: ...


class HttpModerationService:
    def __init__(self, client: httpx.Client, url: str, key: str = ''):
        self.client, self.url, self.key = client, url, key

    def check(self, text: str) -> Decision:
        if not self.url:
            raise ModerationUnavailable()
        try:
            response = self.client.post(self.url, json={'text': text},
                headers={'Authorization': 'Bearer ' + self.key} if self.key else {})
            response.raise_for_status()
            return Decision.model_validate(response.json())
        except (httpx.HTTPError, ValueError, ValidationError):
            raise ModerationUnavailable() from None


def require_allowed(service: ModerationService, text: str):
    try:
        decision = service.check(text)
    except ModerationUnavailable:
        raise HTTPException(503, detail={
            'code': 'MODERATION_UNAVAILABLE',
            'message': 'Не удалось проверить сообщение. Текст не отправлен. Попробуйте снова.',
        }) from None
    if decision.decision == 'BLOCK':
        raise HTTPException(422, detail={
            'code': 'MESSAGE_BLOCKED', 'reason': 'OBSCENITY',
            'message': 'Сообщение не отправлено: обнаружена ненормативная лексика. Переформулируйте его.',
        })
