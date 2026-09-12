--liquibase formatted sql
--changeset team:8 splitStatements:false

-- Preserve existing records; permit initial direct routing only with persisted ML evidence.
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
            IF (NEW.handling_level <> OLD.handling_level + 1 AND NOT (
                OLD.handling_level = 0 AND NEW.handling_level IN (1, 2, 3) AND EXISTS (
                    SELECT 1 FROM messages m WHERE m.claim_id = NEW.id AND m.author_kind = 'AI'
                    AND m.metadata->>'status' = 'ESCALATED'
                    AND m.metadata->'route'->>'line' = 'L' || NEW.handling_level::text
                )
            )) OR NEW.status <> 'NEW' OR NEW.operator_id IS NOT NULL THEN
                RAISE EXCEPTION 'Escalation requires the next tier or an initial ML routing decision' USING ERRCODE = '23514';
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
