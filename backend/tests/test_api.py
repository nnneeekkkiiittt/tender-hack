from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import psycopg
from conftest import create_support_ticket as create_ticket

from app.config import COOKIE


def test_auth_accounts_and_revocation(env):
    _app, admin, make = env
    owner, user = make("MixedCase")
    assert owner.get("/api/auth/me").json() == user
    duplicate = owner.post("/api/auth/register", json={"name": "mixedcase", "password": "user-password-123"})
    assert duplicate.status_code == 409
    assert (
        owner.post(
            "/api/auth/register", json={"name": "promote", "password": "user-password-123", "role": "admin"}
        ).status_code
        == 422
    )
    assert owner.get("/api/users").status_code == 403
    assert owner.get("/api/employees").status_code == 403
    assert (
        owner.post(
            "/api/employees", json={"name": "rogue", "role": "supportL1", "password": "user-password-123"}
        ).status_code
        == 403
    )
    old_cookie = owner.cookies.get(COOKIE)
    assert (
        owner.post(
            "/api/auth/password", json={"current_password": "wrong", "new_password": "changed-password"}
        ).status_code
        == 403
    )
    assert (
        owner.post(
            "/api/auth/password",
            json={"current_password": "user-password-123", "new_password": "changed-password"},
        ).status_code
        == 204
    )
    owner.cookies.set(COOKIE, old_cookie)
    assert owner.get("/api/tickets").status_code == 401
    owner.cookies.clear()
    assert (
        owner.post(
            "/api/auth/login", json={"name": "mixedcase", "password": "changed-password", "remember": True}
        ).status_code
        == 200
    )
    remembered = owner.cookies.get(COOKIE)
    assert (
        admin.post(
            f"/api/users/{user['id']}/password", json={"new_password": "reset-password-123"}
        ).status_code
        == 204
    )
    owner.cookies.clear()
    owner.cookies.set(COOKIE, remembered)
    assert owner.get("/api/auth/me").json() is None
    owner.cookies.clear()
    login = owner.post("/api/auth/login", json={"name": "MixedCase", "password": "reset-password-123"})
    assert login.status_code == 200
    assert "httponly" in login.headers["set-cookie"].lower()
    cookie = owner.cookies.get(COOKIE)
    assert owner.post("/api/auth/logout", json={}).status_code == 204
    owner.cookies.set(COOKIE, cookie)
    assert owner.get("/api/tickets").status_code == 401
    assert admin.post("/api/users/1/password", json={"new_password": "reset-password-123"}).status_code == 403


def test_full_workflow_permissions_and_feedback(actors, database_url):
    _app, admin, owner, other, support, second, owner_user, other_user, staff, staff2 = actors
    ticket = create_ticket(owner)
    path = f"/api/tickets/{ticket['id']}"
    assert ticket["status"] == "NEW"
    assert "conversation_id" not in ticket
    assert other.get(path).status_code == 404
    assert other.get(path + "/messages").status_code == 404
    assert other.get("/api/tickets").json()["total"] == 0
    assert other.post(path + "/messages", json={"text": "intrusion"}).status_code == 404
    assert (
        owner.post(path + "/messages", json={"text": "forged", "author_id": staff["id"]}).status_code == 422
    )
    initial = owner.get(path + "/messages").json()["items"][0]
    assert initial["author_kind"] == "USER" and initial["text"] == "Please help"
    with psycopg.connect(database_url) as conn:
        assert conn.execute("SELECT to_regclass('conversations')").fetchone()[0] is None
        assert conn.execute("SELECT claim_id FROM messages WHERE id = %s", (initial["id"],)).fetchone()[
            0
        ] == int(ticket["id"])
    assert owner.put(path + "/feedback", json={"like": True}).status_code == 409
    assert owner.patch(path + "/assign", json={"operator_id": staff["id"]}).status_code == 403
    taken = support.post(path + "/messages", json={"text": "First reply"})
    assert taken.status_code == 201, taken.text
    assert taken.json()["operator_id"] == staff["id"] and taken.json()["status"] == "IN WORK"
    assert second.post(path + "/messages", json={"text": "not assigned"}).status_code == 403
    assert second.patch(path + "/status", json={"status": "DONE"}).status_code == 403
    assert support.patch(path + "/status", json={"status": "CANCELLED"}).status_code == 403
    assert owner.patch(path + "/classification", json={"topic": "OTHER"}).status_code == 403
    assert (
        support.patch(
            path + "/classification", json={"topic": "DOCUMENTS", "subtopic": "Signature"}
        ).status_code
        == 200
    )
    assert admin.patch(path + "/assign", json={"operator_id": other_user["id"]}).status_code == 422
    assert admin.patch(path + "/assign", json={"operator_id": staff2["id"]}).status_code == 200
    assert support.post(path + "/messages", json={"text": "lost access"}).status_code == 403
    assert second.post(path + "/messages", json={"text": "New owner reply"}).status_code == 201
    assert owner.post(path + "/messages", json={"text": "Thanks"}).status_code == 201
    resolved = second.patch(path + "/status", json={"status": "DONE"})
    assert resolved.status_code == 200 and resolved.json()["resolved_at"]
    for client in (owner, support, second, admin):
        assert client.post(path + "/messages", json={"text": "too late"}).status_code == 409
    assert admin.patch(path + "/assign", json={"operator_id": staff["id"]}).status_code == 409
    assert second.patch(path + "/classification", json={"topic": "OTHER"}).status_code == 409
    assert owner.patch(path + "/status", json={"status": "NEW"}).status_code == 422
    assert second.put(path + "/feedback", json={"like": True}).status_code == 403
    assert owner.put(path + "/feedback", json={"like": False}).status_code == 422
    assert owner.put(path + "/feedback", json={"like": True, "reasons": ["SLOW WORK"]}).status_code == 422
    positive = owner.put(path + "/feedback", json={"like": True})
    assert positive.status_code == 200, positive.text
    negative = owner.put(path + "/feedback", json={"like": False, "reasons": ["SLOW WORK"]})
    assert negative.status_code == 200, negative.text
    assert negative.json()["id"] == positive.json()["id"]
    assert negative.json()["operator_id"] == staff2["id"] and negative.json()["reasons"] == ["SLOW WORK"]
    assert admin.get(path + "/feedback").json() == negative.json()
    with psycopg.connect(database_url) as conn:
        events = conn.execute(
            "SELECT actor_id, after_state->>'status' FROM claim_events WHERE claim_id = %s ORDER BY id",
            (ticket["id"],),
        ).fetchall()
        assert events[0] == (int(owner_user["id"]), "NEW")
        assert events[-1] == (int(staff2["id"]), "DONE")


def test_cancellation_lists_and_pagination(actors):
    _, _, owner, other, support, _, _, _, _, _ = actors
    first = create_ticket(owner, text="Alpha")
    second = create_ticket(owner, text="Beta", topic="ACCOUNT")
    create_ticket(other)
    assert owner.get("/api/tickets", params={"limit": 1}).json()["total"] == 2
    assert owner.get("/api/tickets", params={"limit": 1, "offset": 1}).json()["items"][0]["id"] == first["id"]
    assert owner.get("/api/tickets", params={"topic": "ACCOUNT"}).json()["items"][0]["id"] == second["id"]
    assert owner.get("/api/tickets", params={"search": "Alpha"}).json()["total"] == 1
    assert owner.get("/api/tickets", params={"search": "' OR 1=1 --"}).json()["total"] == 0
    assert support.get("/api/tickets", params={"unassigned": True}).json()["total"] == 3
    path = f"/api/tickets/{first['id']}"
    for text in ("one", "two", "three"):
        assert owner.post(path + "/messages", json={"text": text}).status_code == 201
    newest = owner.get(path + "/messages", params={"limit": 2}).json()
    older = owner.get(path + "/messages", params={"limit": 2, "before_id": newest["next_before"]}).json()
    assert [m["text"] for m in newest["items"]] == ["two", "three"]
    assert [m["text"] for m in older["items"]] == [
        "Обращение передано в поддержку L1. История сохранена.",
        "one",
    ]
    assert older["next_before"] is not None
    assert owner.get(f"/api/tickets/{second['id']}/messages").json()["items"][0]["text"] == "Beta"
    assert owner.patch(path + "/status", json={"status": "CANCELLED"}).json()["cancelled_at"]
    assert owner.put(path + "/feedback", json={"like": True}).status_code == 409
    assert owner.post(path + "/messages", json={"text": "late"}).status_code == 409


def test_competing_first_replies(actors, database_url):
    _, _, owner, _, support, second, _, _, _, _ = actors
    ticket = create_ticket(owner)
    barrier = Barrier(2)

    def reply(client):
        barrier.wait()
        return client.post(f"/api/tickets/{ticket['id']}/messages", json={"text": "I will handle this"})

    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(reply, (support, second)))
    assert sorted(r.status_code for r in results) == [201, 403]
    with psycopg.connect(database_url) as conn:
        assert (
            conn.execute("SELECT count(*) FROM messages WHERE claim_id = %s", (ticket["id"],)).fetchone()[0]
            == 5
        )
        assert (
            conn.execute("SELECT count(*) FROM claim_events WHERE claim_id = %s", (ticket["id"],)).fetchone()[
                0
            ]
            == 3
        )


def test_close_message_race(actors, database_url):
    _, _, owner, _, support, _, _, _, staff, _ = actors
    ticket = create_ticket(owner)
    path = f"/api/tickets/{ticket['id']}"
    assert support.patch(path + "/assign", json={"operator_id": staff["id"]}).status_code == 200
    barrier = Barrier(2)

    def close():
        barrier.wait()
        return support.patch(path + "/status", json={"status": "DONE"})

    def reply():
        barrier.wait()
        return owner.post(path + "/messages", json={"text": "Racing reply"})

    with ThreadPoolExecutor(max_workers=2) as workers:
        closing, replying = workers.submit(close), workers.submit(reply)
        assert closing.result().status_code == 200
        assert replying.result().status_code in (201, 409)
    with psycopg.connect(database_url) as conn:
        assert (
            conn.execute(
                "SELECT count(*) FROM messages m JOIN claims c ON c.id = m.claim_id WHERE c.id = %s AND m.sent_at > c.resolved_at",
                (ticket["id"],),
            ).fetchone()[0]
            == 0
        )


def test_csrf_limits_and_employee_management(env):
    app, admin, make = env
    user, _ = make("ordinary")
    assert user.post("/api/tickets", json={}, headers={"X-Requested-With": ""}).status_code == 403
    assert user.post("/api/tickets", json={}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert user.post("/api/tickets", content="x" * 131073).status_code == 413
    staff, person = make("staff-old", "supportL1")
    updated = admin.patch(f"/api/employees/{person['id']}", json={"name": "staff-new", "role": "supportL2"})
    assert updated.status_code == 200
    assert staff.get("/api/auth/me").json()["name"] == "staff-new"
    assert admin.get("/api/employees", params={"search": "staff-new"}).json()["total"] == 1
    assert (
        admin.patch(f"/api/employees/{person['id']}", json={"name": "staff-new", "role": "admin"}).status_code
        == 422
    )
    app.state.settings.auth_rate_limit = 1
    assert user.post("/api/auth/login", json={"name": "ordinary", "password": "bad"}).status_code == 429


def test_health_and_public_contract(env):
    _, admin, _ = env
    assert admin.get("/health/live").status_code == 200
    assert admin.get("/health/ready").status_code == 200
    assert "/api/tickets/{ticket_id}/feedback" in admin.get("/openapi.json").json()["paths"]
    profile = admin.get("/api/auth/me")
    assert set(profile.json()) == {"id", "name", "role"}
    assert profile.headers["cache-control"] == "no-store"


def test_invalid_ids_and_chunked_body(env):
    _, admin, make = env
    owner, _ = make("invalid-input-user")
    for value in ("0", "-1", "not-a-number", "9999999999999999999999999999"):
        assert owner.get(f"/api/tickets/{value}").status_code == 422
        assert (
            admin.post(f"/api/users/{value}/password", json={"new_password": "test-password-123"}).status_code
            == 422
        )
    assert owner.post("/api/tickets", content=iter([b"x" * 70000, b"x" * 70000])).status_code == 413
