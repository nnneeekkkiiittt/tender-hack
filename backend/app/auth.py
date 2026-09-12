import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from .config import COOKIE, SUPPORT_ROLES
from .db import DB, CurrentUser, find_user, public_user, require_admin
from .models import (
    Credentials,
    EmployeeCreate,
    EmployeeUpdate,
    Identifier,
    Login,
    Page,
    PasswordChange,
    PasswordReset,
    User,
)

router = APIRouter()
passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash("unused-timing-equalizer")


def verify(password, hashed):
    try:
        return passwords.verify(password, hashed)
    except (UnknownHashError, ValueError):
        return False


def create_session(conn, user, response, settings, remember=False):
    token = secrets.token_urlsafe(32)
    lifetime = timedelta(days=30) if remember else timedelta(hours=12)
    conn.execute(
        """INSERT INTO auth_sessions(user_id, token_hash, auth_version, expires_at)
        VALUES (%s, %s, %s, %s)""",
        (
            user["id"],
            hashlib.sha256(token.encode()).hexdigest(),
            user["auth_version"],
            datetime.now(timezone.utc) + lifetime,
        ),
    )
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api",
        max_age=int(lifetime.total_seconds()) if remember else None,
    )


@router.post("/auth/register", response_model=User, status_code=201)
def register(body: Credentials, response: Response, request: Request, conn: DB):
    user = conn.execute(
        "INSERT INTO users(name, role, hash) VALUES (%s, 'user', %s) RETURNING *",
        (body.name, passwords.hash(body.password)),
    ).fetchone()
    create_session(conn, user, response, request.app.state.settings)
    return public_user(user)


@router.post("/auth/login", response_model=User)
def login(body: Login, response: Response, request: Request, conn: DB):
    user = conn.execute(
        "SELECT * FROM users WHERE lower(name) = lower(%s) FOR UPDATE", (body.name,)
    ).fetchone()
    valid = verify(body.password, user["hash"] if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, "Invalid username or password")
    create_session(conn, user, response, request.app.state.settings, body.remember)
    return public_user(user)


@router.get("/auth/me", response_model=User | None)
def me(request: Request, conn: DB):
    user = find_user(conn, request.cookies.get(COOKIE))
    return public_user(user) if user else None


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, conn: DB):
    token = request.cookies.get(COOKIE, "")
    conn.execute(
        "UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE token_hash = %s",
        (hashlib.sha256(token.encode()).hexdigest(),),
    )
    response.delete_cookie(COOKIE, path="/api")


@router.post("/auth/password", status_code=204)
def change_password(body: PasswordChange, response: Response, user: CurrentUser, conn: DB):
    row = conn.execute("SELECT * FROM users WHERE id = %s FOR UPDATE", (user["id"],)).fetchone()
    if row["auth_version"] != user["auth_version"] or not verify(body.current_password, row["hash"]):
        raise HTTPException(403, "Current password is incorrect or the session has expired")
    conn.execute("UPDATE users SET hash = %s WHERE id = %s", (passwords.hash(body.new_password), user["id"]))
    response.delete_cookie(COOKIE, path="/api")


def directory(conn, employee, search, offset, limit):
    role_clause = "role IN ('supportL1', 'supportL2', 'supportL3')" if employee else "role = 'user'"
    pattern = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    where = role_clause + " AND name ILIKE %s"
    total = conn.execute(f"SELECT count(*) AS total FROM users WHERE {where}", (pattern,)).fetchone()["total"]
    rows = conn.execute(
        f"SELECT id, name, role FROM users WHERE {where} ORDER BY id LIMIT %s OFFSET %s",
        (pattern, limit, offset),
    ).fetchall()
    return {"items": [public_user(row) for row in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/users", response_model=Page[User])
def users(
    user: CurrentUser,
    conn: DB,
    search: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
):
    require_admin(user)
    return directory(conn, False, search, offset, limit)


@router.get("/employees", response_model=Page[User])
def employees(
    user: CurrentUser,
    conn: DB,
    search: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
):
    require_admin(user)
    return directory(conn, True, search, offset, limit)


@router.post("/employees", response_model=User, status_code=201)
def create_employee(body: EmployeeCreate, user: CurrentUser, conn: DB):
    require_admin(user)
    row = conn.execute(
        "INSERT INTO users(name, role, hash) VALUES (%s, %s, %s) RETURNING *",
        (body.name, body.role, passwords.hash(body.password)),
    ).fetchone()
    return public_user(row)


@router.patch("/employees/{employee_id}", response_model=User)
def update_employee(employee_id: Identifier, body: EmployeeUpdate, user: CurrentUser, conn: DB):
    require_admin(user)
    target = conn.execute("SELECT role FROM users WHERE id = %s FOR UPDATE", (employee_id,)).fetchone()
    if not target or target["role"] not in SUPPORT_ROLES:
        raise HTTPException(404, "Support account not found")
    if (
        target["role"] != body.role
        and conn.execute(
            "SELECT 1 FROM claims WHERE operator_id = %s AND status = 'IN WORK' LIMIT 1", (employee_id,)
        ).fetchone()
    ):
        raise HTTPException(409, "Reassign active claims before changing the employee's support level")
    row = conn.execute(
        "UPDATE users SET name = %s, role = %s WHERE id = %s RETURNING *", (body.name, body.role, employee_id)
    ).fetchone()
    return public_user(row)


@router.post("/users/{user_id}/password", status_code=204)
def reset_password(user_id: Identifier, body: PasswordReset, user: CurrentUser, conn: DB):
    require_admin(user)
    target = conn.execute("SELECT role FROM users WHERE id = %s FOR UPDATE", (user_id,)).fetchone()
    if not target:
        raise HTTPException(404, "Account not found")
    if target["role"] == "admin":
        raise HTTPException(403, "Use the administrative recovery command for administrators")
    conn.execute("UPDATE users SET hash = %s WHERE id = %s", (passwords.hash(body.new_password), user_id))
