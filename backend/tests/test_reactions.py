from pathlib import Path

import psycopg
import pytest
from conftest import create_ticket


def test_both_feedback_types_share_reactions(actors, database_url):
    _, _, owner, _, support, _, _, _, staff, _ = actors
    ticket = create_ticket(owner)
    path = f"/api/tickets/{ticket['id']}"
    ai = owner.get(path + "/messages").json()["items"][1]
    dislike = path + f"/messages/{ai['id']}/feedback"
    liked = owner.put(dislike, json={"like": True, "reasons": []})
    assert liked.status_code == 200 and liked.json()["target_kind"] == "AI_MESSAGE"
    assert owner.get(path).json()["handling_level"] == 0
    message = owner.get(path + "/messages").json()["items"][1]
    assert message["liked"] and message["reaction"] == liked.json()
    assert owner.put(dislike, json={"like": False, "reasons": []}).status_code == 422
    assert owner.put(dislike, json={"like": False, "reasons": ["INCORRECT ANSWER"]}).status_code == 200
    assert owner.put(dislike, json={"like": True, "reasons": []}).json()["id"] == liked.json()["id"]
    assert owner.get(path).json()["handling_level"] == 1
    assert owner.put(dislike, json={"like": False, "reasons": ["INCORRECT ANSWER"]}).status_code == 200
    assert owner.get(path + "/feedback").json() is None
    assert support.patch(path + "/assign", json={"operator_id": staff["id"]}).status_code == 200
    assert support.patch(path + "/status", json={"status": "DONE"}).status_code == 200
    assert owner.put(path + "/feedback", json={"like": False}).status_code == 422
    rating = owner.put(path + "/feedback", json={"like": False, "reasons": ["SLOW WORK"]})
    assert rating.status_code == 200
    edited = owner.put(path + "/feedback", json={"like": True})
    assert edited.status_code == 200 and edited.json()["id"] == rating.json()["id"]
    assert owner.get(path + "/messages").json()["items"][1]["disliked"]
    with psycopg.connect(database_url) as conn:
        assert conn.execute("SELECT to_regclass('message_feedback')").fetchone()[0] is None
        rows = conn.execute(
            'SELECT target_kind, message_id, operator_id, "like", reasons::text[] FROM reactions WHERE claim_id = %s ORDER BY target_kind',
            (ticket["id"],),
        ).fetchall()
        assert rows == [
            ("AI_MESSAGE", int(ai["id"]), None, False, ["INCORRECT ANSWER"]),
            ("OPERATOR", None, int(staff["id"]), True, []),
        ]
        for sql, error in [
            (
                "UPDATE reactions SET message_id = NULL WHERE target_kind = 'AI_MESSAGE'",
                psycopg.errors.CheckViolation,
            ),
            (
                "UPDATE reactions SET operator_id = 1 WHERE target_kind = 'AI_MESSAGE'",
                psycopg.errors.CheckViolation,
            ),
            (
                "UPDATE reactions SET message_id = (SELECT min(id) FROM messages WHERE author_kind = 'USER') WHERE target_kind = 'AI_MESSAGE'",
                psycopg.errors.CheckViolation,
            ),
            ("UPDATE reactions SET target_kind = 'UNKNOWN'", psycopg.errors.CheckViolation),
            (
                'INSERT INTO reactions(claim_id, message_id, target_kind, submitted_by, "like", reasons) SELECT claim_id, message_id, target_kind, submitted_by, "like", reasons FROM reactions WHERE target_kind = \'AI_MESSAGE\'',
                psycopg.errors.UniqueViolation,
            ),
            ('UPDATE reactions SET reasons = NULL WHERE NOT "like"', psycopg.errors.CheckViolation),
        ]:
            with pytest.raises(error), conn.transaction():
                conn.execute(sql)


def test_migration_preserves_both_kinds_of_feedback(database_url):
    migrations = Path(__file__).resolve().parents[2] / "db/migrations"
    with psycopg.connect(database_url) as conn:
        conn.execute("CREATE SCHEMA reaction_upgrade")
        conn.execute("SET LOCAL search_path = reaction_upgrade")
        for path in sorted(migrations.glob("00[12345]-*.sql")):
            conn.execute(path.read_text())
        conn.execute(
            "INSERT INTO users(name, role, hash) VALUES ('owner', 'user', 'x'), ('operator', 'supportL1', 'x')"
        )
        conn.execute("INSERT INTO claims(author_id, title) VALUES (1, 'First'), (1, 'Second')")
        conn.execute(
            "INSERT INTO messages(claim_id, author_kind, text) VALUES (1, 'AI', 'First answer'), (2, 'AI', 'Second answer')"
        )
        conn.execute("UPDATE claims SET handling_level = 1 WHERE id = 1")
        conn.execute("UPDATE claims SET operator_id = 2, status = 'IN WORK' WHERE id = 1")
        conn.execute("UPDATE claims SET status = 'DONE' WHERE id = 1")
        conn.execute(
            'INSERT INTO reactions(claim_id, "operator", submitted_by, "like", reason) VALUES (1, 2, 1, false, ARRAY[\'SLOW WORK\']::reason[])'
        )
        conn.execute(
            "INSERT INTO message_feedback(message_id, submitted_by, helpful, created_at, updated_at) VALUES (1, 1, false, '2026-01-01Z', '2026-01-02Z'), (2, 1, true, '2026-02-01Z', '2026-02-02Z')"
        )
        operators = conn.execute(
            'SELECT id, claim_id, "operator", submitted_by, "like", reason, created_at, updated_at FROM reactions'
        ).fetchall()
        ai = conn.execute(
            "SELECT m.claim_id, f.message_id, f.submitted_by, f.helpful, f.created_at, f.updated_at FROM message_feedback f JOIN messages m ON m.id=f.message_id ORDER BY f.message_id"
        ).fetchall()
        claims = conn.execute("SELECT * FROM claims ORDER BY id").fetchall()
        events = conn.execute("SELECT * FROM claim_events ORDER BY id").fetchall()
        conn.execute((migrations / "006-unified-reactions.sql").read_text())
        conn.execute((migrations / "007-reaction-reasons.sql").read_text())
        assert conn.execute("SELECT to_regclass('message_feedback')").fetchone()[0] is None
        assert (
            conn.execute(
                "SELECT id, claim_id, operator_id, submitted_by, \"like\", reasons, created_at, updated_at FROM reactions WHERE target_kind = 'OPERATOR'"
            ).fetchall()
            == operators
        )
        assert (
            conn.execute(
                "SELECT claim_id, message_id, submitted_by, \"like\", created_at, updated_at FROM reactions WHERE target_kind = 'AI_MESSAGE' ORDER BY message_id"
            ).fetchall()
            == ai
        )
        assert conn.execute("SELECT * FROM claims ORDER BY id").fetchall() == claims
        assert conn.execute("SELECT * FROM claim_events ORDER BY id").fetchall() == events
        conn.rollback()


def test_shared_reaction_validation_and_response(actors):
    _, _, owner, _, support, _, _, _, staff, _ = actors
    ai_claim, human_claim = create_ticket(owner), create_ticket(owner)
    ai_path, human_path = f"/api/tickets/{ai_claim['id']}", f"/api/tickets/{human_claim['id']}"
    message = owner.get(ai_path + "/messages").json()["items"][1]
    assert owner.post(human_path + "/messages", json={"text": "Need support"}).status_code == 201
    assert support.patch(human_path + "/assign", json={"operator_id": staff["id"]}).status_code == 200
    assert support.patch(human_path + "/status", json={"status": "DONE"}).status_code == 200
    endpoints = [ai_path + f"/messages/{message['id']}/feedback", human_path + "/feedback"]
    fields = {"id", "claim_id", "submitted_by", "target_kind", "message_id", "operator_id", "like", "reasons"}
    for endpoint in endpoints:
        for invalid in [
            {"like": False, "reasons": []},
            {"like": True, "reasons": ["SLOW WORK"]},
            {"like": False, "reasons": ["SLOW WORK", "SLOW WORK"]},
            {"like": False, "reasons": ["UNKNOWN"]},
        ]:
            assert owner.put(endpoint, json=invalid).status_code == 422
        negative = owner.put(endpoint, json={"like": False, "reasons": ["SLOW WORK", "INCORRECT ANSWER"]})
        assert negative.status_code == 200 and set(negative.json()) == fields
        positive = owner.put(endpoint, json={"like": True, "reasons": []})
        assert positive.status_code == 200 and set(positive.json()) == fields
        assert positive.json()["id"] == negative.json()["id"] and positive.json()["reasons"] == []
    assert owner.get(ai_path).json()["handling_level"] == 1
    assert owner.get(human_path).json()["status"] == "DONE"
