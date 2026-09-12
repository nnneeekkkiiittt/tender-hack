"""Shared persistence for AI-message and operator reactions."""

SELECT_REACTION = """SELECT id::text, claim_id::text, submitted_by::text,
    target_kind, message_id::text, operator_id::text, "like",
    coalesce(reasons::text[], ARRAY[]::text[]) AS reasons FROM reactions"""


def read_reaction(conn, claim_id, operator_id=None, message_id=None):
    if message_id is not None:
        where, target = "target_kind = 'AI_MESSAGE' AND message_id = %s", message_id
    else:
        where, target = "target_kind = 'OPERATOR' AND operator_id = %s", operator_id
    return conn.execute(SELECT_REACTION + " WHERE claim_id = %s AND " + where, (claim_id, target)).fetchone()


def save_reaction(conn, claim, user, body, message_id=None):
    ai = message_id is not None
    operator_id = None if ai else claim["operator_id"]
    conflict = "message_id, submitted_by" if ai else "claim_id, operator_id"
    conn.execute(
        """INSERT INTO reactions(claim_id, submitted_by, target_kind, message_id, operator_id, "like", reasons)
        VALUES (%s, %s, %s, %s, %s, %s, %s::reason[])
        ON CONFLICT ("""
        + conflict
        + """) DO UPDATE
        SET "like" = EXCLUDED."like", reasons = EXCLUDED.reasons, updated_at = clock_timestamp()""",
        (
            claim["id"],
            user["id"],
            "AI_MESSAGE" if ai else "OPERATOR",
            message_id,
            operator_id,
            body.like,
            body.reasons,
        ),
    )
    return read_reaction(conn, claim["id"], operator_id, message_id)
