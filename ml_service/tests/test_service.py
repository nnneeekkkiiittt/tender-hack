from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.ml.generator import AnswerGenerator
from app.ml.pipeline import SupportMLPipeline
from app.ml.retriever import KBRetriever
from app.ml.schemas import RetrievedChunk, RouteDecision


def pipeline(line="L2", chunks=None, answer="Ответ по документации"):
    return SupportMLPipeline(
        router=Mock(route=Mock(return_value=RouteDecision(line=line))),
        retriever=Mock(search=Mock(return_value=chunks or [])),
        generator=Mock(generate=Mock(return_value=answer)),
    )


def test_l3_skips_retrieval_and_returns_escalation_contract():
    p = pipeline("L3")
    result = TestClient(create_app(lambda: p)).post("/ask", json={"question": "500 error"})
    assert result.status_code == 200
    body = result.json()
    assert body["status"] == "ESCALATED" and body["route"]["line"] == "L3"
    assert body["context_card"]["user_query"] == "500 error"
    assert body["sources"] == []
    assert "высоким приоритетом" not in body["answer"]
    p.retriever.search.assert_not_called()
    p.generator.generate.assert_not_called()


@pytest.mark.parametrize("line", ["L1", "L2"])
def test_no_context_escalates_to_classified_tier(line):
    result = pipeline(line).process("Help")
    assert result.status == "ESCALATED" and result.route.line == line
    assert result.context_card.escalation_reason


def test_generator_insufficient_evidence_escalates_without_exposing_marker():
    chunk = RetrievedChunk(text="Unrelated text", doc_name="Manual")
    result = pipeline("L2", chunks=[chunk], answer="[NO_CONTEXT]").process("Help")
    assert result.status == "ESCALATED" and result.route.line == "L2"
    assert "[NO_CONTEXT]" not in result.answer


def test_exact_leaf_section_match_does_not_match_parent_role():
    from app.ml.retriever import heading_match

    query = "Как загрузить доверенность в профиль пользователя?"
    assert heading_match(query, "13.1 Профиль пользователя > 13.1.5.2 Профиль компании") == 0
    assert heading_match(query, "13.1 Профиль пользователя > 13.1.5.1 Профиль пользователя") > 0


def test_sources_preserve_page_ranges_and_explicit_edition():
    chunk = RetrievedChunk(
        text="Manual body", doc_name="Manual", page=246, page_end=248, edition="11.08.2026v87"
    )
    result = (
        TestClient(create_app(lambda: pipeline(chunks=[chunk])))
        .post("/ask", json={"question": "Help"})
        .json()
    )
    assert result["sources"] == ["Manual (стр. 246–248) · ред. 11.08.2026v87"]
    assert result["context_card"]["sources_found"][0]["page_end"] == 248


def test_multiple_fragments_on_same_page_keep_citation_numbering():
    chunks = [RetrievedChunk(text=text, doc_name="Manual", page=2) for text in ("First", "Second")]
    result = (
        TestClient(create_app(lambda: pipeline(chunks=chunks))).post("/ask", json={"question": "Help"}).json()
    )
    assert result["sources"] == ["Manual (стр. 2)", "Manual (стр. 2)"]


def test_off_topic_remains_a_reply_without_escalation():
    p = pipeline("OUT_OF_SCOPE")
    result = p.process("Weather")
    assert result.status == "OUT_OF_SCOPE" and result.context_card is None
    p.retriever.search.assert_not_called()


def test_answer_preserves_citations_and_operator_context():
    chunk = RetrievedChunk(text="Manual body", doc_name="Manual", breadcrumb="Setup", page=2)
    p = pipeline(chunks=[chunk])
    response = TestClient(create_app(lambda: p)).post("/ask", json={"question": "Help"})
    assert response.status_code == 200
    body = response.json()
    assert body["sources"] == ["Manual > Setup (стр. 2)"]
    assert body["citations"][0]["text"] == "Manual body"
    assert body["context_card"]["bot_answer"] == body["answer"]
    assert body["status"] == "AUTO_RESOLVED"
    p.router.route.assert_called_once()
    p.generator.generate.assert_called_once()


def test_errors_are_http_failures_not_resolved_answers():
    p = pipeline()
    p.retriever.search.side_effect = RuntimeError("private connection information")
    response = TestClient(create_app(lambda: p)).post("/ask", json={"question": "Help"})
    assert response.status_code == 503
    assert "private" not in response.text and "AUTO_RESOLVED" not in response.text


def test_generator_and_embedding_failures_are_not_answers():
    generator = AnswerGenerator()
    generator.session = Mock(post=Mock(side_effect=RuntimeError("offline")))
    with pytest.raises(RuntimeError, match="Generation"):
        generator.generate("Help", [])
    retriever = KBRetriever.__new__(KBRetriever)
    retriever.tei_url = "http://tei"
    retriever.session = Mock(post=Mock(side_effect=RuntimeError("offline")))
    with pytest.raises(RuntimeError, match="Embedding"):
        retriever.embed_queries_batch(["Help"])


def test_auth_input_validation_and_health_are_separate():
    factory = Mock(return_value=pipeline("L3"))
    client = TestClient(create_app(factory, api_key="secret"))
    assert client.get("/health/live").status_code == 200
    assert client.post("/ask", json={"question": "Help"}).status_code == 401
    factory.assert_not_called()
    for body in ({"question": " "}, {"question": "x" * 10001}, {"question": "x", "history": []}):
        assert client.post("/ask", json=body, headers={"Authorization": "Bearer secret"}).status_code == 422
    assert (
        client.post("/ask", json={"question": "Help"}, headers={"Authorization": "Bearer secret"}).status_code
        == 200
    )


def test_ready_requires_indexed_documents(monkeypatch):
    from app.main import settings

    def response(url, **kwargs):
        body = (
            {"data": [{"id": settings.MODEL_NAME}]}
            if url.endswith("/models")
            else {"result": {"points_count": 0}}
        )
        return SimpleNamespace(raise_for_status=lambda: None, json=lambda: body)

    monkeypatch.setattr("app.main.requests.get", response)
    assert TestClient(create_app()).get("/health/ready").status_code == 503
