BEGIN;
CREATE FUNCTION pg_temp.expect_error(command TEXT, expected TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    BEGIN EXECUTE command;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = expected THEN RETURN; END IF;
        RAISE;
    END;
    RAISE EXCEPTION 'Expected %, but succeeded: %', expected, command;
END $$;

INSERT INTO users(name, role, hash) VALUES ('owner', 'user', 'test-only'), ('support', 'supportL1', 'test-only');
SELECT pg_temp.expect_error('INSERT INTO users(name, role, hash) VALUES (''OWNER'', ''user'', ''x'')', '23505');
SET LOCAL app.actor_id = '1';
INSERT INTO claims(author_id, title) VALUES (1, 'Test claim');
INSERT INTO messages(claim_id, author, author_kind, text) VALUES (1, 1, 'USER', 'Question');
INSERT INTO messages(claim_id, author_kind, text) VALUES (1, 'AI', 'Answer');
SELECT pg_temp.expect_error('INSERT INTO messages(claim_id, author, author_kind, text) VALUES (1, 1, ''AI'', ''forged'')', '23514');
SELECT pg_temp.expect_error('INSERT INTO messages(claim_id, author, author_kind, text) VALUES (999, 1, ''USER'', ''orphan'')', '23503');
SELECT pg_temp.expect_error('INSERT INTO messages(author, author_kind, text) VALUES (1, ''USER'', ''orphan'')', '23502');
INSERT INTO reactions(claim_id, message_id, submitted_by, target_kind, "like", reasons) VALUES (1, 2, 1, 'AI_MESSAGE', false, ARRAY['INCORRECT ANSWER']::reason[]);
SELECT pg_temp.expect_error('INSERT INTO reactions(claim_id, message_id, submitted_by, target_kind, "like", reasons) VALUES (1, 2, 1, ''AI_MESSAGE'', false, ARRAY[''INCORRECT ANSWER'']::reason[])', '23505');
SELECT pg_temp.expect_error('UPDATE claims SET status = ''DONE'' WHERE id = 1', '23514');
SELECT pg_temp.expect_error('UPDATE claims SET handling_level = 2 WHERE id = 1', '23514');
SELECT pg_temp.expect_error('INSERT INTO messages(claim_id, author_kind, text) VALUES (1, ''AI'', ''second'')', '23505');
UPDATE claims SET handling_level = 1 WHERE id = 1;
UPDATE claims SET status = 'IN WORK', operator_id = 2 WHERE id = 1;
UPDATE claims SET status = 'DONE' WHERE id = 1;
SELECT pg_temp.expect_error('UPDATE claims SET status = ''NEW'' WHERE id = 1', '23514');
SELECT pg_temp.expect_error('DELETE FROM claim_events WHERE claim_id = 1', '23514');
SELECT pg_temp.expect_error('UPDATE messages SET text = ''edited'' WHERE id = 1', '23514');
INSERT INTO reactions(claim_id, operator_id, submitted_by, "like") VALUES (1, 2, 1, true);
SELECT pg_temp.expect_error('INSERT INTO reactions(claim_id, operator_id, submitted_by, "like") VALUES (1, 2, 1, true)', '23505');
SELECT pg_temp.expect_error('UPDATE reactions SET "like" = false WHERE target_kind = ''OPERATOR''', '23514');
SELECT pg_temp.expect_error('UPDATE reactions SET submitted_by = 2 WHERE target_kind = ''OPERATOR''', '23503');
UPDATE reactions SET "like" = false, reasons = ARRAY['SLOW WORK']::reason[] WHERE target_kind = 'OPERATOR';
INSERT INTO auth_sessions(user_id, token_hash, auth_version, expires_at) VALUES (1, repeat('a',64), 0, now() + interval '1 hour');
UPDATE users SET hash = 'changed' WHERE id = 1;
DO $$ BEGIN
    IF (SELECT count(*) FROM claim_events WHERE claim_id = 1 AND actor_id = 1) <> 4
       OR NOT (SELECT assigned_at IS NOT NULL AND resolved_at IS NOT NULL FROM claims WHERE id = 1)
       OR NOT (SELECT auth_version = 1 FROM users WHERE id = 1)
       OR NOT (SELECT revoked_at IS NOT NULL FROM auth_sessions WHERE user_id = 1) THEN
        RAISE EXCEPTION 'Timestamps, history, or password revocation failed';
    END IF;
END $$;
ROLLBACK;
