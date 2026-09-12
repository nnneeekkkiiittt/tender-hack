import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai import AiService, AiServiceError, HttpAiService, MockAiService
from app.config import COOKIE, Settings
from app.main import create_app
from app.models import AiAnswer


def test_mock_is_stateless_and_uses_the_shared_contract():
    service: AiService = MockAiService()
    first = service.ask("Первый вопрос")
    second = service.ask("Второй вопрос")
    assert isinstance(first, AiAnswer)
    assert first == service.ask("Первый вопрос")
    assert first.sources == [] and second.sources == []
    assert "Mock AI" in second.answer and "Первый вопрос" not in second.answer
    assert len(service.ask("я" * 10000).answer) <= 20000


def test_ai_implementation_can_be_injected(env, database_url):
    _, admin, _ = env
    service = MockAiService()
    app = create_app(Settings(database_url=database_url, ai_mode="http"), ai_service=service)
    with TestClient(app) as client:
        assert app.state.ai_service is service
        client.cookies.set(COOKIE, admin.cookies.get(COOKIE))
        assert client.get("/api/auth/me").status_code == 200


def test_invalid_ai_mode_is_rejected():
    with pytest.raises(ValueError, match="AI_MODE"):
        create_app(Settings(ai_mode="typo"))


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, content=b"x" * 131073),
        httpx.Response(200, json={"answer": ""}),
        httpx.Response(503, text="private upstream error"),
    ],
)
def test_http_errors_never_fall_back_to_mock(response):
    with httpx.Client(transport=httpx.MockTransport(lambda _: response)) as client:
        service: AiService = HttpAiService(client, "https://ai.example/ask")
        with pytest.raises(AiServiceError) as error:
            service.ask("Question")
        assert error.value.status_code == 502
        assert "private" not in str(error.value) and "Mock AI" not in str(error.value)


def test_http_contract_preserves_question_and_sources():
    calls = []

    def upstream(request):
        assert request.headers["authorization"] == "Bearer test-token"
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"answer": "Manual answer", "sources": ["Manual"]})

    with httpx.Client(transport=httpx.MockTransport(upstream)) as client:
        answer = HttpAiService(client, "https://ai.example/ask", "test-token").ask("Help")
    assert answer == AiAnswer(answer="Manual answer", sources=["Manual"])
    assert calls == [{"question": "Help"}]
