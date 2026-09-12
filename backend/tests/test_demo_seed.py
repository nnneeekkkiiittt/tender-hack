import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from conftest import AllowModeration


def test_seed_is_opt_in():
    with pytest.raises(ValueError, match="DEMO_SEED"):
        create_app(Settings(demo_seed=True, demo_accounts=False))


def test_seed_restart_preserves_changes(env, database_url):
    settings = Settings(database_url=database_url, demo_accounts=True, demo_seed=True, ai_mode="mock")
    headers = {"X-Requested-With": "tender"}
    with TestClient(create_app(settings, moderation_service=AllowModeration()), headers=headers) as client:
        client.post("/api/auth/demo/user", json={})
        claims = client.get("/api/tickets").json()["items"]
        assert len(claims) == 5
        assert {c["handling_level"] for c in claims} == {0, 1, 2, 3}
        assert sum(c["status"] == "DONE" for c in claims) == 1
        ai = next(c for c in claims if c["handling_level"] == 0)
        assert client.post(f"/api/tickets/{ai['id']}/messages", json={"text": "Keep my change"}).status_code == 201
    with psycopg.connect(database_url) as conn:
        before = [conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                  for table in ("users", "claims", "messages", "reactions", "claim_events")]
    with TestClient(create_app(settings), headers=headers) as client:
        client.post("/api/auth/demo/user", json={})
        assert client.get(f"/api/tickets/{ai['id']}").json()["handling_level"] == 1
    with psycopg.connect(database_url) as conn:
        after = [conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                 for table in ("users", "claims", "messages", "reactions", "claim_events")]
        assert before == after
