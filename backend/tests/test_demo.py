from fastapi.testclient import TestClient

from app.config import COOKIE, Settings
from app.main import create_app


def test_demo_disabled_by_default(env):
    _, admin, _ = env
    assert admin.get("/api/auth/demo").json() == []
    assert admin.post("/api/auth/demo/admin", json={}).status_code == 404


def test_demo_switches_real_accounts_without_claim_leakage(env, database_url):
    _, _, make = env
    real, real_user = make("demo-admin")
    app = create_app(Settings(database_url=database_url, demo_accounts=True, ai_mode="mock"))
    with TestClient(app, headers={"X-Requested-With": "tender"}) as client:
        accounts = client.get("/api/auth/demo").json()
        assert {u["role"] for u in accounts} == {"admin", "supportL1", "supportL2", "supportL3", "user"}
        assert real_user["id"] not in {u["id"] for u in accounts}
        assert real.get("/api/auth/me").json() == real_user
        assert (
            client.post("/api/auth/demo/admin", json={}, headers={"X-Requested-With": ""}).status_code == 403
        )
        assert (
            client.post(
                "/api/auth/demo/admin", json={}, headers={"Origin": "https://evil.example"}
            ).status_code
            == 403
        )
        assert client.post("/api/auth/demo/not-a-role", json={}).status_code == 422
        consumer = client.post("/api/auth/demo/user", json={}).json()
        token = client.cookies.get(COOKIE)
        claim = client.post("/api/tickets", json={"text": "Demo claim"}).json()
        assert claim["author_id"] == consumer["id"]
        assert (
            client.post(f"/api/tickets/{claim['id']}/messages", json={"text": "Need L1"}).status_code == 201
        )
        for role in ("admin", "supportL1", "supportL2", "supportL3"):
            response = client.post("/api/auth/demo/" + role, json={})
            assert response.status_code == 200
            assert client.get("/api/auth/me").json()["role"] == role
            assert client.get("/api/users").status_code == (200 if role == "admin" else 403)
            total = client.get("/api/tickets").json()["total"]
            assert total == (1 if role in ("admin", "supportL1") else 0)
        old = TestClient(app)
        old.cookies.set(COOKIE, token)
        assert old.get("/api/auth/me").json() is None
        old.close()
        assert client.post("/api/auth/demo/user", json={}).json() == consumer
        assert client.get("/api/tickets").json()["items"][0]["id"] == claim["id"]
        last_token = client.cookies.get(COOKIE)
    with TestClient(create_app(Settings(database_url=database_url, demo_accounts=True))) as client:
        assert client.get("/api/auth/demo").json() == accounts
    with TestClient(create_app(Settings(database_url=database_url, demo_accounts=False))) as client:
        client.cookies.set(COOKIE, last_token)
        assert client.get("/api/auth/me").json() is None
        assert client.get("/api/auth/demo").json() == []
