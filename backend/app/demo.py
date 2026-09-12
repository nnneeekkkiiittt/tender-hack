"""Opt-in local testing accounts. Never enable on a public deployment."""

import hashlib
import secrets

from fastapi import APIRouter, HTTPException, Request, Response

from .auth import create_session, passwords
from .config import COOKIE
from .db import DB, public_user
from .models import Role, User

router = APIRouter()
NAMES = {
    "admin": "demo-admin",
    "supportL1": "demo-l1",
    "supportL2": "demo-l2",
    "supportL3": "demo-l3",
    "user": "demo-consumer",
}


def provision(conn):
    conn.execute("SELECT pg_advisory_xact_lock(7301952)")
    for role, name in NAMES.items():
        if conn.execute("SELECT 1 FROM demo_accounts WHERE role = %s", (role,)).fetchone():
            continue
        # A name collision must not turn a real account into a public demo identity.
        if conn.execute("SELECT 1 FROM users WHERE lower(name) = lower(%s)", (name,)).fetchone():
            name += "-" + secrets.token_hex(6)
        user = conn.execute(
            "INSERT INTO users(name, role, hash) VALUES (%s, %s, %s) RETURNING id",
            (name, role, passwords.hash(secrets.token_urlsafe(48))),
        ).fetchone()
        conn.execute("INSERT INTO demo_accounts(role, user_id) VALUES (%s, %s)", (role, user["id"]))


@router.get("/auth/demo", response_model=list[User])
def accounts(request: Request, conn: DB):
    if not request.app.state.settings.demo_accounts:
        return []
    return [
        public_user(row)
        for row in conn.execute(
            "SELECT u.* FROM demo_accounts d JOIN users u ON u.id = d.user_id WHERE u.role::text = d.role ORDER BY d.role"
        ).fetchall()
    ]


@router.post("/auth/demo/{role}", response_model=User)
def switch(role: Role, request: Request, response: Response, conn: DB):
    if not request.app.state.settings.demo_accounts:
        raise HTTPException(404, "Demo accounts are disabled")
    user = conn.execute(
        "SELECT u.* FROM demo_accounts d JOIN users u ON u.id = d.user_id WHERE d.role = %s AND u.role::text = d.role FOR UPDATE OF u",
        (role,),
    ).fetchone()
    if not user:
        raise HTTPException(409, "Demo account is unavailable")
    token = request.cookies.get(COOKIE, "")
    conn.execute(
        "UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE token_hash = %s",
        (hashlib.sha256(token.encode()).hexdigest(),),
    )
    create_session(conn, user, response, request.app.state.settings)
    return public_user(user)
