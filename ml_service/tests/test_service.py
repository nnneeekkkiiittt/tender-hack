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


def test_generator_cuts_off_chinese_degradation():
    gen = AnswerGenerator()
    gen.session = Mock()
    mock_resp = Mock()
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Шаг 1: перейдите в закупки. 参加者的问题: 如何参与采购?"}}]
    }
    mock_resp.raise_for_status = Mock()
    gen.session.post.return_value = mock_resp

    answer = gen.generate("Как принять участие?", [])
    assert "Шаг 1: перейдите в закупки." in answer

def test_keyword_match_for_error_code():
    retriever = KBRetriever.__new__(KBRetriever)
    chunk = RetrievedChunk(
        text="При ошибке РДИК_0217 нажмите кнопку обновить.",
        doc_name="Инструкция",
        breadcrumb="Раздел 8.5",
        page=67,
    )
    retriever._cached_chunks = [(chunk, chunk.text.lower(), chunk.breadcrumb.lower())]
    matches = retriever._search_keyword_matches("ошибка РДИК_0217", "manuals_e5_v1")
    assert len(matches) == 1
    assert matches[0].page == 67
    assert "РДИК_0217" in matches[0].text


def test_extract_action_for_error_fallback():
    from app.ml.generator import extract_action_for_error, AnswerGenerator

    chunk = RetrievedChunk(
        text="3) При возникновении ошибок: • РДИК_0217, – требуется нажать на кнопку «Обновить данные из контракта ЕИС» (Рисунок 65).",
        doc_name="Инструкция",
        page=67,
    )
    action = extract_action_for_error("ошибка РДИК_0217", [chunk])
    assert action == "При возникновении ошибки РДИК_0217 требуется нажать на кнопку «Обновить данные из контракта ЕИС»."

    # Проверяем, что AnswerGenerator использует extract_action при оборванном ответе LLM
    gen = AnswerGenerator()
    gen.session = Mock()
    mock_resp = Mock()
    mock_resp.json.return_value = {"choices": [{"message": {"content": "Ошибка РДИК_0217 не описана в 《"}}]}
    mock_resp.raise_for_status = Mock()
    gen.session.post.return_value = mock_resp

    answer = gen.generate("ошибка РДИК_0217", [chunk])
    assert answer == "При возникновении ошибки РДИК_0217 требуется нажать на кнопку «Обновить данные из контракта ЕИС»."


def test_cross_encoder_reranker_prioritizes_relevant_chunk():
    from app.ml.reranker import CrossEncoderReranker

    reranker = CrossEncoderReranker()
    chunk1 = RetrievedChunk(text="Общие сведения о системе и регламенте торгов.", doc_name="Manual 1", score=0.82)
    chunk2 = RetrievedChunk(text="Порядок загрузки машиночитаемой доверенности МЧД в профиль.", doc_name="Manual 2", score=0.75)
    chunk3 = RetrievedChunk(text="Кулинарные рецепты и выпечка пирогов.", doc_name="Manual 3", score=0.40)

    # Мокируем ranker для детерминированной проверки упорядочивания по скору
    if reranker.ranker is not None:
        reranker.ranker.rerank = Mock(
            return_value=[
                {"id": 1, "score": 0.95, "meta": chunk2},
                {"id": 0, "score": 0.45, "meta": chunk1},
                {"id": 2, "score": 0.10, "meta": chunk3},
            ]
        )

    reranked = reranker.rerank("как загрузить машиночитаемую доверенность МЧД?", [chunk1, chunk2, chunk3], top_k=2)
    assert len(reranked) == 2
    # Чанк про МЧД должен быть на первом месте
    assert "МЧД" in reranked[0].text


def test_suggestion_query_canonical_expansion():
    retriever = KBRetriever.__new__(KBRetriever)
    retriever.session = Mock()
    queries = retriever.expand_query("Какие документы нужны?")
    assert len(queries) >= 3
    assert queries[0] == "Какие документы нужны?"
    assert any("регистрац" in q.lower() or "документ" in q.lower() for q in queries)


def test_keyword_match_ignores_stopwords():
    retriever = KBRetriever.__new__(KBRetriever)
    chunk = RetrievedChunk(
        text="Пользователь выполняет какие-либо нужные действия в системе.",
        doc_name="Инструкция",
        page=10,
    )
    retriever._cached_chunks = [(chunk, chunk.text.lower(), "")]
    # Запрос со стоп-словами без кодов не должен триггерить точный поиск
    matches = retriever._search_keyword_matches("Какие документы нужны?", "manuals_e5_v1")
    assert matches == []

    # Запрос с технической аббревиатурой должен сработать
    chunk_ecp = RetrievedChunk(
        text="Настройка сертификата ЭЦП и плагина КриптоПро.",
        doc_name="Инструкция",
        page=20,
    )
    retriever._cached_chunks.append((chunk_ecp, chunk_ecp.text.lower(), ""))
    matches_ecp = retriever._search_keyword_matches("Не работает ЭЦП", "manuals_e5_v1")
    assert len(matches_ecp) >= 1
    assert "ЭЦП" in matches_ecp[0].text


def test_clean_text_removes_figures_and_markdown():
    from app.ml.generator import clean_text

    raw = "1. **Нажмите кнопку** «Подать предложение» (Рисунок 545 (3)). Затем (Рисунок 546)."
    cleaned = clean_text(raw)
    assert "**" not in cleaned
    assert "Нажмите кнопку" in cleaned
    assert "Рисунок" not in cleaned
    assert "(3)" not in cleaned
    assert cleaned.endswith(".")


def test_router_routes_rdik_error_to_l2():
    from app.ml.router import IntentRouter
    from app.ml.schemas import SupportLine

    router = IntentRouter()
    router.session = Mock()
    mock_resp = Mock()
    # Модель ошибочно пытается вернуть L1
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": '{"line": "L1", "topic": "Электронное исполнение (ЕИС)", "subtopic": "Формирование УПД (вопросы по ошибкам РДИК)"}'}}]
    }
    mock_resp.raise_for_status = Mock()
    router.session.post.return_value = mock_resp

    decision = router.route("ошибка РДИК_0217")
    # Должно быть перенаправлено на L2, так как это ошибка интеграции/РДИК
    assert decision.line == SupportLine.L2


def test_generator_returns_exact_action_for_rdik_without_llm():
    from app.ml.generator import AnswerGenerator

    gen = AnswerGenerator()
    chunk = RetrievedChunk(
        text="3) При возникновении ошибок: • РДИК_0217, – требуется нажать на кнопку «Обновить данные из контракта ЕИС» (Рисунок 65).",
        doc_name="Инструкция",
        page=67,
    )
    # Вызываем генератор: точное действие должно вернуться сразу без вызова LLM
    answer = gen.generate("ошибка РДИК_0217", [chunk])
    assert answer == "При возникновении ошибки РДИК_0217 требуется нажать на кнопку «Обновить данные из контракта ЕИС»."


def test_retriever_expand_query_preserves_error_code():
    retriever = KBRetriever.__new__(KBRetriever)
    queries = retriever.expand_query("ошибка РДИК_0217")
    assert "ошибка РДИК_0217" in queries
    assert any("0217" in q for q in queries)

