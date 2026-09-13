from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import httpx
import psycopg
from conftest import create_ticket, react_ai

from app.ai import HttpAiService
from app.models import AiAnswer


class CountingAi:
    def __init__(self):
        self.questions = []

    def ask(self, question):
        self.questions.append(question)
        return AiAnswer(answer="Documented answer", sources=["Manual, section 4"])


def history(client, path):
    return client.get(path + "/messages").json()["items"]


def race(*actions):
    barrier = Barrier(len(actions))

    def run(action):
        barrier.wait()
        return action()

    with ThreadPoolExecutor(max_workers=len(actions)) as workers:
        return list(workers.map(run, actions))


def test_initial_answer_idempotency_and_persistent_history(env):
    app, admin, make = env
    owner, _ = make("unified-owner")
    other, _ = make("unified-other")
    ai = app.state.ai_service = CountingAi()
    payload = {"text": "Question", "request_id": str(uuid4())}
    first, retry = race(*(lambda: owner.post("/api/tickets", json=payload) for _ in range(2)))
    assert first.status_code == retry.status_code == 201
    assert first.json()["id"] == retry.json()["id"]
    path = f"/api/tickets/{first.json()['id']}"
    assert first.json()["handling_level"] == 0
    assert first.json()["operator_id"] == '0'
    initial = history(owner, path)
    assert [m["author_kind"] for m in initial] == ["USER", "AI"]
    assert initial[1]["sources"] == ["Manual, section 4"]
    assert initial[1]["author_id"] is None
    assert other.get(path).status_code == 404
    assert admin.post("/api/tickets", json=payload).status_code == 403
    assert owner.post("/api/ai/ask", json={"question": "No separate endpoint"}).status_code == 404
    for text in ("Follow up", "Another follow up"):
        reply = owner.post(path + "/messages", json={"text": text})
        assert reply.status_code == 201
        assert reply.json()["handling_level"] == 1
        assert reply.json()["status"] == "NEW" and reply.json()["operator_id"] is None
    assert history(owner, path)[:2] == initial
    assert ai.questions == ["Question"]
    assert owner.get("/api/tickets").json()["total"] == 1
    assert sum(m["author_kind"] == "SYSTEM" for m in history(owner, path)) == 1
    assert owner.post("/api/tickets", json={"text": "x", "quoted_ai_answer": "fake"}).status_code == 422


def test_dislike_and_followup_race_only_handoff_once(env):
    app, admin, make = env
    owner, _ = make("dislike-owner")
    other, _ = make("dislike-other")
    app.state.ai_service = CountingAi()
    ticket = create_ticket(owner)
    path = f"/api/tickets/{ticket['id']}"
    first, ai = history(owner, path)
    url = path + f"/messages/{ai['id']}/feedback"
    assert other.put(url, json={"like": False, "reasons": ["INCORRECT ANSWER"]}).status_code == 404
    assert admin.put(url, json={"like": False, "reasons": ["INCORRECT ANSWER"]}).status_code == 403
    assert (
        owner.put(
            path + f"/messages/{first['id']}/feedback", json={"like": False, "reasons": ["INCORRECT ANSWER"]}
        ).status_code
        == 422
    )
    assert react_ai(owner, url, True)["handling_level"] == 0
    other_claim = create_ticket(owner)
    assert (
        owner.put(
            f"/api/tickets/{other_claim['id']}/messages/{ai['id']}/feedback",
            json={"like": False, "reasons": ["INCORRECT ANSWER"]},
        ).status_code
        == 422
    )
    results = race(
        lambda: owner.put(url, json={"like": False, "reasons": ["INCORRECT ANSWER"]}),
        lambda: owner.post(path + "/messages", json={"text": "Still stuck"}),
    )
    assert sorted(r.status_code for r in results) == [200, 201]
    assert react_ai(owner, url, False)["handling_level"] == 1
    messages = history(owner, path)
    assert messages[1]["disliked"]
    assert sum(m["author_kind"] == "SYSTEM" for m in messages) == 1
    assert len(messages) == 4


def test_all_tiers_and_operator_only_escalation(env):
    _, admin, make = env
    owner, _ = make("tiers-owner")
    staff = [make(f"tier-{n}", f"supportL{n}") for n in (1, 2, 3)]
    peer, peer_user = make("tier-one-peer", "supportL1")
    ticket = create_ticket(owner)
    path = f"/api/tickets/{ticket['id']}"
    ai_id = history(owner, path)[1]["id"]
    dislike = path + f"/messages/{ai_id}/feedback"
    for client, user in staff:
        assert client.get("/api/tickets").json()["total"] == 0
        assert client.post(path + "/messages", json={"text": "Premature reply"}).status_code == 403
        assert client.patch(path + "/assign", json={"operator_id": user["id"]}).status_code == 409
    assert admin.post(path + "/messages", json={"text": "Premature reply"}).status_code == 409
    assert react_ai(owner, dislike, False)["handling_level"] == 1
    for level, (client, user) in enumerate(staff, 1):
        assert client.get("/api/tickets").json()["total"] == 1
        assert client.get("/api/tickets", params={"handling_level": 0}).status_code == 403
        for other, other_user in staff:
            if other is client:
                continue
            assert other.get("/api/tickets").json()["total"] == 0
            assert other.post(path + "/messages", json={"text": "Wrong level"}).status_code == 403
            assert admin.patch(path + "/assign", json={"operator_id": other_user["id"]}).status_code == 422
        if level < 3:
            assert client.post(path + "/escalate", json={"expected_level": level}).status_code == 403
        assigned = client.patch(path + "/assign", json={"operator_id": user["id"]})
        assert assigned.status_code == 200, assigned.text
        assert assigned.json()["assigned_at"]
        assert client.post(path + "/messages", json={"text": f"Answer L{level}"}).status_code == 201
        assert (
            admin.patch(
                f"/api/employees/{user['id']}",
                json={"name": user["name"], "role": "supportL2" if level != 2 else "supportL1"},
            ).status_code
            == 409
        )
        assert (
            owner.post(path + "/messages", json={"text": f"User reply L{level}"}).json()["handling_level"]
            == level
        )
        assert react_ai(owner, dislike, False)["handling_level"] == level
        if level == 1:
            assert peer.post(path + "/escalate", json={"expected_level": 1}).status_code == 403
            assert admin.patch(path + "/assign", json={"operator_id": peer_user["id"]}).status_code == 200
            assert client.post(path + "/escalate", json={"expected_level": 1}).status_code == 403
            assert admin.patch(path + "/assign", json={"operator_id": user["id"]}).status_code == 200
        if level < 3:
            assert admin.post(path + "/escalate", json={"expected_level": level}).status_code == 403
            assert owner.post(path + "/escalate", json={"expected_level": level}).status_code == 403
            results = race(
                *(
                    lambda client=client, level=level: client.post(
                        path + "/escalate", json={"expected_level": level}
                    )
                    for _ in range(2)
                )
            )
            assert sorted(r.status_code for r in results) == [200, 409]
            escalated = owner.get(path).json()
            assert escalated["handling_level"] == level + 1 and escalated["status"] == "NEW"
            assert escalated["operator_id"] is None and escalated["assigned_at"] is None
        else:
            assert client.post(path + "/escalate", json={"expected_level": 3}).status_code == 422
            assert client.patch(path + "/status", json={"status": "DONE"}).status_code == 200
    messages = history(owner, path)
    assert sum(m["author_kind"] == "AI" for m in messages) == 1
    assert sum(m["author_kind"] == "SYSTEM" for m in messages) == 3
    assert owner.put(dislike, json={"like": False, "reasons": ["INCORRECT ANSWER"]}).status_code == 409
    assert owner.post(path + "/messages", json={"text": "Closed"}).status_code == 409
    rating = owner.put(path + "/feedback", json={"like": True})
    assert rating.status_code == 200 and rating.json()["operator_id"] == staff[-1][1]["id"]


def test_ai_failure_keeps_question_and_followup_handoff(env):
    app, _, make = env
    owner, _ = make("failure-owner")

    def timeout(_):
        raise httpx.ReadTimeout("private upstream detail")

    for transport in (lambda _: httpx.Response(200, json={"bad": "payload"}), timeout):
        with httpx.Client(transport=httpx.MockTransport(transport)) as client:
            app.state.ai_service = HttpAiService(client, "https://ai.example/ask")
            claim = create_ticket(owner)
            path = f"/api/tickets/{claim['id']}"
            messages = history(owner, path)
            assert [m["author_kind"] for m in messages] == ["USER", "SYSTEM"]
            assert "private" not in messages[1]["text"]
            assert claim["handling_level"] == 0
            assert owner.post(path + "/messages", json={"text": "Help"}).json()["handling_level"] == 1


def test_upgrade_preserves_existing_claims(database_url):
    migrations = Path(__file__).resolve().parents[2] / "db/migrations"
    with psycopg.connect(database_url) as conn:
        # Separate transactional schema; rollback leaves the main test schema untouched.
        conn.execute("CREATE SCHEMA upgrade_test")
        conn.execute("SET LOCAL search_path = upgrade_test")
        for path in sorted(migrations.glob("00[123]-*.sql")):
            conn.execute(path.read_text())
        conn.execute(
            "INSERT INTO users(name, role, hash) VALUES ('owner', 'user', 'x'), ('l2', 'supportL2', 'x'), ('l3', 'supportL3', 'x')"
        )
        conn.execute(
            "INSERT INTO claims(author_id, title) VALUES (1, 'Queued'), (1, 'Assigned'), (1, 'Resolved')"
        )
        conn.execute(
            "INSERT INTO messages(claim_id, author, author_kind, text) VALUES (3, 1, 'USER', 'Original question')"
        )
        conn.execute("UPDATE claims SET status = 'IN WORK', operator_id = 2 WHERE id = 2")
        conn.execute("UPDATE claims SET status = 'IN WORK', operator_id = 3 WHERE id = 3")
        conn.execute("UPDATE claims SET status = 'DONE' WHERE id = 3")
        before = conn.execute(
            "SELECT id, status, operator_id, assigned_at, resolved_at, updated_at FROM claims ORDER BY id"
        ).fetchall()
        events = conn.execute("SELECT * FROM claim_events ORDER BY id").fetchall()
        conn.execute((migrations / "004-unified-chat.sql").read_text())
        assert (
            conn.execute(
                "SELECT id, status, operator_id, assigned_at, resolved_at, updated_at FROM claims ORDER BY id"
            ).fetchall()
            == before
        )
        assert conn.execute("SELECT handling_level FROM claims ORDER BY id").fetchall() == [(1,), (2,), (3,)]
        assert conn.execute("SELECT * FROM claim_events ORDER BY id").fetchall() == events
        assert conn.execute("SELECT text FROM messages").fetchone()[0] == "Original question"
        assert (
            conn.execute(
                "INSERT INTO claims(author_id, title) VALUES (1, 'New chat') RETURNING handling_level"
            ).fetchone()[0]
            == 0
        )
        conn.rollback()
