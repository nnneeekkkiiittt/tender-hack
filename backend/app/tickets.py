from fastapi import APIRouter, HTTPException, Query, Request
from psycopg.types.json import Jsonb

from .ai import AiService, AiServiceError
from .config import SUPPORT_ROLES
from .db import DB, CurrentUser
from .models import (
    Assignment,
    Classification,
    Escalation,
    Identifier,
    MessageCreate,
    MessagePage,
    Page,
    Reaction,
    ReactionInput,
    Status,
    StatusChange,
    Ticket,
    TicketCreate,
    Topic,
)
from .reactions import read_reaction, save_reaction

router = APIRouter()
SELECT_TICKET = """SELECT c.*, a.name AS author_name, o.name AS operator_name
    FROM claims c JOIN users a ON a.id = c.author_id LEFT JOIN users o ON o.id = c.operator_id"""


def serialize(row):
    return {
        **row,
        **{
            key: str(row[key]) if row[key] is not None else None for key in ("id", "author_id", "operator_id")
        },
    }


def load_ticket(conn, ticket_id, user, lock=False):
    row = conn.execute(
        SELECT_TICKET + " WHERE c.id = %s" + (" FOR UPDATE OF c" if lock else ""), (ticket_id,)
    ).fetchone()
    if not row or (user["role"] == "user" and row["author_id"] != user["id"]):
        raise HTTPException(404, "Claim not found")
    return row


def active(row):
    if row["status"] in ("DONE", "CANCELLED"):
        raise HTTPException(409, "This claim is closed and read-only")


def staff_write(row, user):
    if row["handling_level"] == 0:
        raise HTTPException(409, "AI is handling this claim; wait for the user to request support")
    if user["role"] != "admin" and not (user["role"] in SUPPORT_ROLES and row["operator_id"] == user["id"]):
        raise HTTPException(403, "Only the assigned operator or an administrator may do this")


def require_level(conn, row, user):
    current = conn.execute("SELECT role FROM users WHERE id = %s FOR SHARE", (user["id"],)).fetchone()
    if not current or current["role"] != f"supportL{row['handling_level']}":
        raise HTTPException(403, "Only support at the claim's current level may handle it")


def advance(conn, row, level=None):
    level = level if level is not None else row["handling_level"] + 1
    conn.execute(
        "UPDATE claims SET handling_level = %s, status = 'NEW', operator_id = NULL WHERE id = %s",
        (level, row["id"]),
    )
    conn.execute(
        "INSERT INTO messages(claim_id, author_kind, text) VALUES (%s, 'SYSTEM', %s)",
        (row["id"], f"Обращение передано в поддержку L{level}. История сохранена."),
    )


@router.get("/tickets", response_model=Page[Ticket])
def list_tickets(
    user: CurrentUser,
    conn: DB,
    status: Status | None = None,
    topic: Topic | None = None,
    operator_id: int | None = Query(None, gt=0, le=9223372036854775807),
    unassigned: bool = False,
    handling_level: int | None = Query(None, ge=0, le=3),
    search: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    clauses, params = [], []
    if user["role"] == "user":
        clauses.append("c.author_id = %s")
        params.append(user["id"])
    if user["role"] in SUPPORT_ROLES:
        own_level = int(user["role"][-1])
        if handling_level is not None and handling_level != own_level:
            raise HTTPException(403, "Support queues are restricted to your level")
        handling_level = own_level
    for value, clause in (
        (status, "c.status = %s"),
        (topic, "c.topic = %s"),
        (operator_id, "c.operator_id = %s"),
        (handling_level, "c.handling_level = %s"),
    ):
        if value is not None:
            clauses.append(clause)
            params.append(value)
    if unassigned:
        clauses.append("c.operator_id IS NULL")
    if search:
        pattern = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        clauses.append("(c.title ILIKE %s OR a.name ILIKE %s OR c.id::text = %s)")
        params.extend((pattern, pattern, search.lstrip("#")))
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    total = conn.execute(
        "SELECT count(*) AS total FROM claims c JOIN users a ON a.id = c.author_id" + where, params
    ).fetchone()["total"]
    rows = conn.execute(
        SELECT_TICKET + where + " ORDER BY c.id DESC LIMIT %s OFFSET %s", [*params, limit, offset]
    ).fetchall()
    return {"items": [serialize(row) for row in rows], "total": total, "offset": offset, "limit": limit}


@router.post("/tickets", response_model=Ticket, status_code=201)
def create_ticket(body: TicketCreate, user: CurrentUser, conn: DB, request: Request):
    if user["role"] != "user":
        raise HTTPException(403, "Only users create claims")
    row = conn.execute(
        """INSERT INTO claims(author_id, title, topic, request_id)
        VALUES (%s, %s, %s, %s) ON CONFLICT (author_id, request_id) DO NOTHING RETURNING id""",
        (user["id"], body.text[:255], body.topic, body.request_id),
    ).fetchone()
    if not row:
        existing = conn.execute(
            "SELECT id FROM claims WHERE author_id = %s AND request_id = %s", (user["id"], body.request_id)
        ).fetchone()
        return serialize(load_ticket(conn, existing["id"], user))
    conn.execute(
        "INSERT INTO messages(claim_id, author, author_kind, text) VALUES (%s, %s, 'USER', %s)",
        (row["id"], user["id"], body.text),
    )
    service: AiService = request.app.state.ai_service
    try:
        answer = service.ask(body.text)
        conn.execute(
            "INSERT INTO messages(claim_id, author_kind, text, metadata) VALUES (%s, 'AI', %s, %s)",
            (row["id"], answer.answer, Jsonb(answer.model_dump(mode="json", exclude={"answer"}))),
        )
        if answer.status == "ESCALATED":
            advance(conn, row, int(answer.route.line[-1]))
    except AiServiceError as exc:
        conn.execute(
            "INSERT INTO messages(claim_id, author_kind, text, metadata) VALUES (%s, 'SYSTEM', %s, %s)",
            (
                row["id"],
                "AI временно недоступен. Отправьте следующее сообщение, чтобы передать обращение поддержке L1.",
                Jsonb({"ai_error": exc.status_code}),
            ),
        )
    return serialize(load_ticket(conn, row["id"], user))


@router.get("/tickets/{ticket_id}", response_model=Ticket)
def get_ticket(ticket_id: Identifier, user: CurrentUser, conn: DB):
    return serialize(load_ticket(conn, ticket_id, user))


@router.get("/tickets/{ticket_id}/messages", response_model=MessagePage)
def messages(
    ticket_id: Identifier,
    user: CurrentUser,
    conn: DB,
    before_id: int | None = Query(None, gt=0, le=9223372036854775807),
    limit: int = Query(50, ge=1, le=100),
):
    row = load_ticket(conn, ticket_id, user)
    items = conn.execute(
        """SELECT m.id::text, m.author::text AS author_id, u.name AS author_name,
        m.author_kind, m.text, m.sent_at, coalesce(m.metadata->'sources', '[]'::jsonb) AS sources,
        CASE WHEN %s THEN m.metadata->'context_card' END AS ml_context,
        coalesce(NOT r."like", false) AS disliked, coalesce(r."like", false) AS liked,
        CASE WHEN r.id IS NOT NULL THEN to_jsonb(r) || jsonb_build_object(
            'id', r.id::text, 'claim_id', r.claim_id::text, 'submitted_by', r.submitted_by::text,
            'message_id', r.message_id::text, 'operator_id', r.operator_id::text,
            'reasons', coalesce(r.reasons::text[], ARRAY[]::text[])) END AS reaction
        FROM messages m LEFT JOIN users u ON u.id = m.author
        LEFT JOIN reactions r ON r.message_id = m.id AND r.target_kind = 'AI_MESSAGE'
        WHERE m.claim_id = %s AND (%s::bigint IS NULL OR m.id < %s)
        ORDER BY m.id DESC LIMIT %s""",
        (user["role"] != "user", row["id"], before_id, before_id, limit + 1),
    ).fetchall()
    return {
        "items": list(reversed(items[:limit])),
        "next_before": items[limit - 1]["id"] if len(items) > limit else None,
    }


@router.post("/tickets/{ticket_id}/messages", response_model=Ticket, status_code=201)
def send_message(ticket_id: Identifier, body: MessageCreate, user: CurrentUser, conn: DB):
    row = load_ticket(conn, ticket_id, user, lock=True)
    active(row)
    if user["role"] in SUPPORT_ROLES:
        require_level(conn, row, user)
    if user["role"] in SUPPORT_ROLES and row["operator_id"] is None:
        conn.execute(
            "UPDATE claims SET operator_id = %s, status = 'IN WORK' WHERE id = %s", (user["id"], ticket_id)
        )
        row["operator_id"] = user["id"]
    if user["role"] != "user":
        staff_write(row, user)
    kind = "USER" if user["role"] == "user" else "ADMIN" if user["role"] == "admin" else "SUPPORT"
    conn.execute(
        "INSERT INTO messages(claim_id, author, author_kind, text) VALUES (%s, %s, %s, %s)",
        (row["id"], user["id"], kind, body.text),
    )
    if user["role"] == "user" and row["handling_level"] == 0:
        advance(conn, row)
    return serialize(load_ticket(conn, ticket_id, user))


@router.patch("/tickets/{ticket_id}/assign", response_model=Ticket)
def assign(ticket_id: Identifier, body: Assignment, user: CurrentUser, conn: DB):
    row = load_ticket(conn, ticket_id, user, lock=True)
    active(row)
    if row["handling_level"] == 0:
        raise HTTPException(409, "The user must request support before assignment")
    if user["role"] != "admin":
        if user["role"] not in SUPPORT_ROLES or body.operator_id != user["id"]:
            raise HTTPException(403, "Support can only take claims for themselves")
        if row["operator_id"] is not None and row["operator_id"] != user["id"]:
            raise HTTPException(409, "Another operator already owns this claim")
    target = conn.execute("SELECT role FROM users WHERE id = %s FOR SHARE", (body.operator_id,)).fetchone()
    if not target or target["role"] not in SUPPORT_ROLES:
        raise HTTPException(422, "Choose a support account")
    if target["role"] != f"supportL{row['handling_level']}":
        raise HTTPException(422, "Choose an operator at the claim's current support level")
    if row["operator_id"] != body.operator_id:
        conn.execute(
            "UPDATE claims SET operator_id = %s, status = 'IN WORK' WHERE id = %s",
            (body.operator_id, ticket_id),
        )
    return serialize(load_ticket(conn, ticket_id, user))


@router.post("/tickets/{ticket_id}/escalate", response_model=Ticket)
def escalate(ticket_id: Identifier, body: Escalation, user: CurrentUser, conn: DB):
    row = load_ticket(conn, ticket_id, user, lock=True)
    active(row)
    if row["handling_level"] != body.expected_level:
        raise HTTPException(409, "The handling level has changed; refresh the claim")
    require_level(conn, row, user)
    staff_write(row, user)
    advance(conn, row)
    return serialize(load_ticket(conn, ticket_id, user))


@router.put("/tickets/{ticket_id}/messages/{message_id}/feedback", response_model=Reaction)
def react_to_ai(
    ticket_id: Identifier, message_id: Identifier, body: ReactionInput, user: CurrentUser, conn: DB
):
    row = load_ticket(conn, ticket_id, user, lock=True)
    active(row)
    if row["author_id"] != user["id"]:
        raise HTTPException(403, "Only the claim author may rate its AI answer")
    message = conn.execute(
        "SELECT author_kind FROM messages WHERE id = %s AND claim_id = %s", (message_id, ticket_id)
    ).fetchone()
    if not message or message["author_kind"] != "AI":
        raise HTTPException(422, "Feedback must target this claim's AI answer")
    reaction = save_reaction(conn, row, user, body, message_id)
    if not body.like and row["handling_level"] == 0:
        advance(conn, row)
    return reaction


@router.patch("/tickets/{ticket_id}/status", response_model=Ticket)
def change_status(ticket_id: Identifier, body: StatusChange, user: CurrentUser, conn: DB):
    row = load_ticket(conn, ticket_id, user, lock=True)
    active(row)
    if body.status == "CANCELLED":
        if row["author_id"] != user["id"]:
            raise HTTPException(403, "Only the claim author can cancel it")
    else:
        if user["role"] in SUPPORT_ROLES:
            require_level(conn, row, user)
        staff_write(row, user)
        if row["status"] != "IN WORK":
            raise HTTPException(409, "Assign this claim before resolving it")
    conn.execute("UPDATE claims SET status = %s WHERE id = %s", (body.status, ticket_id))
    return serialize(load_ticket(conn, ticket_id, user))


@router.patch("/tickets/{ticket_id}/classification", response_model=Ticket)
def classify(ticket_id: Identifier, body: Classification, user: CurrentUser, conn: DB):
    row = load_ticket(conn, ticket_id, user, lock=True)
    active(row)
    if user["role"] in SUPPORT_ROLES:
        require_level(conn, row, user)
    staff_write(row, user)
    conn.execute(
        "UPDATE claims SET topic = %s, subtopic = %s WHERE id = %s",
        (body.topic, body.subtopic or None, ticket_id),
    )
    return serialize(load_ticket(conn, ticket_id, user))


@router.get("/tickets/{ticket_id}/feedback", response_model=Reaction | None)
def get_feedback(ticket_id: Identifier, user: CurrentUser, conn: DB):
    row = load_ticket(conn, ticket_id, user)
    return read_reaction(conn, ticket_id, row["operator_id"])


@router.put("/tickets/{ticket_id}/feedback", response_model=Reaction)
def rate(ticket_id: Identifier, body: ReactionInput, user: CurrentUser, conn: DB):
    row = load_ticket(conn, ticket_id, user, lock=True)
    if row["author_id"] != user["id"]:
        raise HTTPException(403, "Only the claim author can leave feedback")
    if row["status"] != "DONE":
        raise HTTPException(409, "Feedback is available after resolution")
    return save_reaction(conn, row, user, body)
