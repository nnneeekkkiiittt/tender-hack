from typing import Annotated

from fastapi import Depends, HTTPException, Request
from psycopg import Connection

from .config import COOKIE


def get_db(request: Request):
    # Function scope commits before FastAPI sends a success response or session cookie.
    with request.app.state.pool.connection() as conn:
        yield conn


DB = Annotated[Connection, Depends(get_db, scope="function")]


def find_user(conn, token):
    if not token or len(token) > 128:
        return None
    import hashlib

    return conn.execute(
        """
        SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp()
          AND s.auth_version = u.auth_version AND (u.deleted_at IS NULL)
    """,
        (hashlib.sha256(token.encode()).hexdigest(),),
    ).fetchone()


def current_user(request: Request, conn: DB):
    user = find_user(conn, request.cookies.get(COOKIE))
    if not user:
        raise HTTPException(401, "Please sign in")
    conn.execute("SELECT set_config('app.actor_id', %s, true)", (str(user["id"]),))
    return user


CurrentUser = Annotated[dict, Depends(current_user, scope="function")]


def require_admin(user):
    if user["role"] != "admin":
        raise HTTPException(403, "Administrator access required")


def public_user(row):
    return {"id": str(row["id"]), "name": row["name"], "role": row["role"]}
