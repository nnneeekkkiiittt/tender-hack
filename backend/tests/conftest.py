import os
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.moderation import Decision


class AllowModeration:
    """Explicit test double; production has no silent moderation bypass."""
    def check(self, text):
        return Decision(decision='ALLOW', reason=None, policy_version='test')


@pytest.fixture(scope="session")
def database_url():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("Use bash backend/tests/run.sh; TEST_DATABASE_URL must target an isolated test database")
    with psycopg.connect(url) as conn:
        if conn.info.dbname != "tender_test":
            pytest.fail("Refusing to modify a database not named tender_test")
        if conn.execute("SELECT to_regclass('users')").fetchone()[0]:
            pytest.fail("Tests require a new, empty database")
        for path in sorted((Path(__file__).resolve().parents[2] / "db/migrations").glob("*.sql")):
            conn.execute(path.read_text())
    return url


@pytest.fixture
def env(database_url):
    with psycopg.connect(database_url) as conn:
        conn.execute(
            "TRUNCATE auth_sessions, reactions, claim_events, messages, claims, users RESTART IDENTITY CASCADE"
        )
        conn.execute("INSERT INTO users(id, name, role, hash) OVERRIDING SYSTEM VALUE VALUES (0, 'AI', 'supportL1', 'disabled')")
    app = create_app(
        Settings(
            database_url=database_url,
            bootstrap_name="administrator",
            bootstrap_password="admin-password-123",
            auth_rate_limit=1000,
            ai_mode="mock",
            ai_url="",
            ai_api_key="",
        ),
        moderation_service=AllowModeration(),
    )
    clients = []
    with TestClient(app, headers={"X-Requested-With": "tender"}) as admin:
        assert (
            admin.post(
                "/api/auth/login", json={"name": "administrator", "password": "admin-password-123"}
            ).status_code
            == 200
        )

        def client(name, role="user"):
            c = TestClient(app, headers={"X-Requested-With": "tender"})
            clients.append(c)
            if role == "user":
                response = c.post("/api/auth/register", json={"name": name, "password": "user-password-123"})
            else:
                response = admin.post(
                    "/api/employees", json={"name": name, "password": "user-password-123", "role": role}
                )
                assert response.status_code == 201, response.text
                response = c.post("/api/auth/login", json={"name": name, "password": "user-password-123"})
            assert response.status_code in (200, 201), response.text
            return c, response.json()

        yield app, admin, client
        for c in clients:
            c.close()


@pytest.fixture
def actors(env):
    app, admin, make_client = env
    owner, owner_user = make_client("owner")
    other, other_user = make_client("outsider")
    support, support_user = make_client("operator-one", "supportL1")
    second, second_user = make_client("operator-two", "supportL1")
    return app, admin, owner, other, support, second, owner_user, other_user, support_user, second_user


def create_ticket(client, **extra):
    response = client.post(
        "/api/tickets",
        json={"text": "Please help", "topic": "TECHNICAL", **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_support_ticket(client, **extra):
    ticket = create_ticket(client, **extra)
    response = client.post(f"/api/tickets/{ticket['id']}/messages", json={"text": "Need support"})
    assert response.status_code == 201, response.text
    return response.json()


def react_ai(client, url, like=False):
    response = client.put(url, json={"like": like, "reasons": [] if like else ["INCORRECT ANSWER"]})
    assert response.status_code == 200, response.text
    return client.get(url.split("/messages/")[0]).json()
