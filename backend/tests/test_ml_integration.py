from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import pytest
from conftest import create_ticket

from app.ai import AiServiceError, HttpAiService


def ml_result(line="L3", status="ESCALATED"):
    return {
        "answer": "Требуется помощь специалиста.",
        "sources": ["Manual > Setup (стр. 2)"],
        "status": status,
        "route": {"line": line, "confidence": 0.9, "topic": "Настройка"},
        "citations": [{"text": "Source text", "doc_name": "Manual", "page": 2}],
        "context_card": {
            "user_query": "Help",
            "classified_line": line,
            "confidence": 0.9,
            "topic": "Настройка",
            "escalation_reason": "Технический инцидент",
        },
    }


@pytest.mark.parametrize("level", [1, 2, 3])
def test_http_ml_routes_to_actual_queue_once_and_keeps_reactions(env, database_url, level):
    app, _, make = env
    owner, _ = make(f"ml-owner-{level}")
    staff = [make(f"ml-staff-{n}", f"supportL{n}") for n in (1, 2, 3)]
    calls = []

    def upstream(request):
        calls.append(request)
        return httpx.Response(200, json=ml_result(f"L{level}"))

    with httpx.Client(transport=httpx.MockTransport(upstream)) as http:
        app.state.ai_service = HttpAiService(http, "http://ml/ask")
        request_id = str(uuid4())
        ticket = create_ticket(owner, request_id=request_id)
        assert create_ticket(owner, request_id=request_id)["id"] == ticket["id"]
        assert len(calls) == 1
    path = f"/api/tickets/{ticket['id']}"
    assert ticket["handling_level"] == level
    assert ticket["status"] == "NEW" and ticket["operator_id"] is None
    messages = owner.get(path + "/messages").json()["items"]
    assert [m["author_kind"] for m in messages] == ["USER", "AI", "SYSTEM"]
    assert f"L{level}" in messages[2]["text"]
    assert messages[1]["sources"] == ["Manual > Setup (стр. 2)"]
    assert messages[1]["ml_context"] is None
    staff_messages = staff[level - 1][0].get(path + "/messages").json()["items"]
    assert staff_messages[1]["ml_context"]["topic"] == "Настройка"
    with psycopg.connect(database_url) as conn:
        metadata = conn.execute(
            "SELECT metadata FROM messages WHERE claim_id=%s AND author_kind='AI'", (ticket["id"],)
        ).fetchone()[0]
        assert metadata["route"]["line"] == f"L{level}"
        assert metadata["context_card"]["topic"] == "Настройка"
        assert metadata["citations"][0]["page"] == 2
    url = path + f"/messages/{messages[1]['id']}/feedback"
    for body in ({"like": True}, {"like": False, "reasons": ["INCORRECT ANSWER"]}):
        assert owner.put(url, json=body).status_code == 200
        assert owner.get(path).json()["handling_level"] == level
    assert owner.post(path + "/messages", json={"text": "Follow up"}).json()["handling_level"] == level
    assert sum(m["author_kind"] == "SYSTEM" for m in owner.get(path + "/messages").json()["items"]) == 1
    for n, (client, user) in enumerate(staff, 1):
        assert client.get("/api/tickets").json()["total"] == int(n == level)
        if n != level:
            assert client.patch(path + "/assign", json={"operator_id": user["id"]}).status_code == 422
    client, user = staff[level - 1]
    assert client.patch(path + "/assign", json={"operator_id": user["id"]}).status_code == 200
    if level < 3:
        assert (
            client.post(path + "/escalate", json={"expected_level": level}).json()["handling_level"]
            == level + 1
        )
    else:
        assert client.post(path + "/escalate", json={"expected_level": 3}).status_code == 422
        assert client.patch(path + "/status", json={"status": "DONE"}).status_code == 200


@pytest.mark.parametrize("status,line", [("AUTO_RESOLVED", "L2"), ("OUT_OF_SCOPE", "OUT_OF_SCOPE")])
def test_ml_non_escalation_does_not_resolve_claim_and_user_can_escalate(env, status, line):
    app, _, make = env
    owner, _ = make("ml-answered")
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=ml_result(line, status)))
    ) as http:
        app.state.ai_service = HttpAiService(http, "http://ml/ask")
        ticket = create_ticket(owner)
    assert ticket["handling_level"] == 0 and ticket["status"] == "NEW"
    path = f"/api/tickets/{ticket['id']}"
    assert owner.post(path + "/messages", json={"text": "Need help"}).json()["handling_level"] == 1


@pytest.mark.parametrize(
    "payload",
    [
        {"answer": "X", "status": "ESCALATED"},
        {"answer": "X", "status": "ESCALATED", "route": {"line": "L4"}},
        {"answer": "X", "status": "ESCALATED", "route": {"line": "OUT_OF_SCOPE"}},
        {"answer": "X", "status": "UNKNOWN"},
    ],
)
def test_invalid_ml_decisions_fail_closed(payload):
    with (
        httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))) as http,
        pytest.raises(AiServiceError),
    ):
        HttpAiService(http, "http://ml/ask").ask("Question")


def test_ml_migration_does_not_rewrite_existing_data(env, database_url):
    _, _, make = env
    owner, _ = make("ml-migration")
    create_ticket(owner)
    with psycopg.connect(database_url) as conn:
        before = [
            conn.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
            for table in ("claims", "messages", "claim_events", "reactions")
        ]
        migration = Path(__file__).resolve().parents[2] / "db/migrations/008-ml-routing.sql"
        conn.execute(migration.read_text())
        after = [
            conn.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
            for table in ("claims", "messages", "claim_events", "reactions")
        ]
        assert after == before
        conn.rollback()  # Do not leave the older trigger installed for later tests.
