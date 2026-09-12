--liquibase formatted sql
--changeset team:4 splitStatements:false

-- Existing claims are already support requests. Keep their current operator/level.
ALTER TABLE claims ADD COLUMN handling_level SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE claims DISABLE TRIGGER claims_prepare;
ALTER TABLE claims DISABLE TRIGGER claims_record;
UPDATE claims c SET handling_level = right(u.role::text, 1)::SMALLINT
FROM users u WHERE c.operator_id = u.id AND u.role IN ('supportL2', 'supportL3');
ALTER TABLE claims ENABLE TRIGGER claims_prepare;
ALTER TABLE claims ENABLE TRIGGER claims_record;
ALTER TABLE claims ALTER COLUMN handling_level SET DEFAULT 0;
ALTER TABLE claims ADD CONSTRAINT claims_handling_level CHECK (handling_level BETWEEN 0 AND 3);
ALTER TABLE claims ADD CONSTRAINT claims_ai_unassigned CHECK (handling_level > 0 OR operator_id IS NULL);
CREATE INDEX claims_level_queue_idx ON claims(handling_level, status, id DESC);
ALTER TABLE claims ADD COLUMN request_id UUID;
ALTER TABLE claims ADD CONSTRAINT claims_request_unique UNIQUE (author_id, request_id);
CREATE UNIQUE INDEX messages_one_ai_per_claim ON messages(claim_id) WHERE author_kind = 'AI';

CREATE OR REPLACE FUNCTION prepare_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'NEW' OR NEW.operator_id IS NOT NULL OR NEW.handling_level <> 0 THEN
            RAISE EXCEPTION 'Claims must start NEW, unassigned, and handled by AI' USING ERRCODE = '23514';
        END IF;
    ELSE
        IF OLD.status IN ('DONE', 'CANCELLED') THEN
            RAISE EXCEPTION 'Terminal claims are read-only' USING ERRCODE = '23514';
        END IF;
        IF ROW(NEW.author_id, NEW.created_at) IS DISTINCT FROM ROW(OLD.author_id, OLD.created_at) THEN
            RAISE EXCEPTION 'Claim identity is immutable' USING ERRCODE = '23514';
        END IF;
        IF NEW.handling_level <> OLD.handling_level THEN
            IF NEW.handling_level <> OLD.handling_level + 1 OR NEW.status <> 'NEW' OR NEW.operator_id IS NOT NULL THEN
                RAISE EXCEPTION 'Escalation moves one level into an unassigned queue' USING ERRCODE = '23514';
            END IF;
        ELSIF OLD.status = 'IN WORK' AND NEW.status = 'NEW' THEN
            RAISE EXCEPTION 'Only escalation may return a claim to NEW' USING ERRCODE = '23514';
        END IF;
        IF OLD.status = 'NEW' AND NEW.status = 'DONE' THEN
            RAISE EXCEPTION 'Assign before resolving' USING ERRCODE = '23514';
        END IF;
        NEW.assigned_at := CASE WHEN NEW.operator_id IS NULL THEN NULL
            WHEN NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN clock_timestamp() ELSE OLD.assigned_at END;
    END IF;
    NEW.updated_at := clock_timestamp();
    NEW.resolved_at := CASE WHEN NEW.status = 'DONE' THEN NEW.updated_at END;
    NEW.cancelled_at := CASE WHEN NEW.status = 'CANCELLED' THEN NEW.updated_at END;
    RETURN NEW;
END $$;
