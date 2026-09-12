"""Explicit, transactional sample data. Never called in non-demo mode."""

import uuid

from psycopg.types.json import Jsonb

from . import demo
from .tickets import advance

SAMPLES = [
    ("ai", "Как загрузить МЧД в профиль пользователя?", 0, False),
    ("l1", "Нужна помощь со входом в личный кабинет", 1, False),
    ("l2", "Уточните порядок работы с документами закупки", 2, False),
    ("l3", "При открытии портала появляется ошибка 500", 3, False),
    ("done", "Помощь с настройкой профиля", 1, True),
]


def seed(conn):
    # Same lock as account provisioning; all samples commit or roll back together.
    demo.provision(conn)
    users = {r["role"]: r["user_id"] for r in conn.execute("SELECT * FROM demo_accounts")}
    author = users["user"]
    created = 0
    for key, question, level, done in SAMPLES:
        request_id = uuid.uuid5(uuid.NAMESPACE_URL, f"tender-demo-v1/{key}")
        if conn.execute(
            "SELECT id FROM claims WHERE author_id = %s AND request_id = %s", (author, request_id)
        ).fetchone():
            continue
        row = conn.execute(
            "INSERT INTO claims(author_id, title, request_id) VALUES (%s, %s, %s) RETURNING *",
            (author, "[Демо] " + question, request_id),
        ).fetchone()
        claim_id = row["id"]
        conn.execute(
            "INSERT INTO messages(claim_id, author, author_kind, text) VALUES (%s, %s, 'USER', %s)",
            (claim_id, author, question),
        )
        conn.execute(
            "INSERT INTO messages(claim_id, author_kind, text, metadata) VALUES (%s, 'AI', %s, %s)",
            (claim_id, "Демонстрационный пример, не ответ модели. Создайте новый вопрос для проверки AI.",
             Jsonb({"sources": [], "demo_fixture": True})),
        )
        for target in range(1, level + 1):
            advance(conn, row, target)
        if done:
            operator = users["supportL1"]
            conn.execute(
                "UPDATE claims SET operator_id = %s, status = 'IN WORK' WHERE id = %s", (operator, claim_id)
            )
            conn.execute(
                "INSERT INTO messages(claim_id, author, author_kind, text) VALUES (%s, %s, 'SUPPORT', %s)",
                (claim_id, operator, "Демонстрационный пример: настройка проверена, вопрос решён."),
            )
            conn.execute("UPDATE claims SET status = 'DONE' WHERE id = %s", (claim_id,))
            conn.execute(
                '''INSERT INTO reactions(claim_id, operator_id, submitted_by, target_kind, "like", reasons)
                   VALUES (%s, %s, %s, 'OPERATOR', true, '{}')''',
                (claim_id, operator, author),
            )
        created += 1
    return created
