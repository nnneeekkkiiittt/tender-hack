--liquibase formatted sql
--changeset team:9 splitStatements:false

-- 1. Добавляем пользователя AI с id = 0
INSERT INTO users (id, name, role, hash)
OVERRIDING SYSTEM VALUE
VALUES (0, 'AI', 'supportL1', 'this-is-some-hash-for-ai')
ON CONFLICT (id) DO NOTHING;

-- 2. Снимаем старые CHECK-констрейнты, требовавшие строго operator_id IS NULL при handling_level = 0
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'claims'::regclass
          AND contype = 'c'
          AND (
            pg_get_constraintdef(oid) LIKE '%operator_id IS NULL%'
            OR pg_get_constraintdef(oid) LIKE '%handling_level > 0%'
          )
    ) LOOP
        EXECUTE 'ALTER TABLE claims DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Добавляем обновлённые констрейнты с поддержкой operator_id = 0
ALTER TABLE claims ADD CONSTRAINT claims_status_operator CHECK (
    (status = 'NEW' AND (operator_id IS NULL OR operator_id = 0)) OR
    (status IN ('IN WORK', 'DONE') AND operator_id IS NOT NULL) OR
    status = 'CANCELLED'
);

ALTER TABLE claims ADD CONSTRAINT claims_operator_assigned_at CHECK (
    ((operator_id IS NULL OR operator_id = 0) AND assigned_at IS NULL) OR
    (operator_id IS NOT NULL AND operator_id <> 0 AND assigned_at IS NOT NULL)
);

ALTER TABLE claims ADD CONSTRAINT claims_ai_unassigned CHECK (
    handling_level > 0 OR operator_id IS NULL OR operator_id = 0
);

-- 4. Обновляем функцию триггера prepare_claim(), разрешая operator_id = 0 при создании заявки
CREATE OR REPLACE FUNCTION prepare_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'NEW' OR (NEW.operator_id IS NOT NULL AND NEW.operator_id <> 0) OR NEW.handling_level <> 0 THEN
            RAISE EXCEPTION 'Claims must start NEW, unassigned (or assigned to AI), and handled by AI' USING ERRCODE = '23514';
        END IF;
        NEW.assigned_at := NULL;
        RETURN NEW;
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
            )) OR NEW.status <> 'NEW' OR (NEW.operator_id IS NOT NULL AND NEW.operator_id <> 0) THEN
                RAISE EXCEPTION 'Escalation requires the next tier or an initial ML routing decision' USING ERRCODE = '23514';
            END IF;
        ELSIF OLD.status = 'IN WORK' AND NEW.status = 'NEW' THEN
            RAISE EXCEPTION 'Only escalation may return a claim to NEW' USING ERRCODE = '23514';
        END IF;
        IF OLD.status = 'NEW' AND NEW.status = 'DONE' THEN
            RAISE EXCEPTION 'Assign before resolving' USING ERRCODE = '23514';
        END IF;
        NEW.assigned_at := CASE WHEN NEW.operator_id IS NULL OR NEW.operator_id = 0 THEN NULL
            WHEN NEW.operator_id IS DISTINCT FROM OLD.operator_id THEN clock_timestamp() ELSE OLD.assigned_at END;
    END IF;
    NEW.updated_at := clock_timestamp();
    NEW.resolved_at := CASE WHEN NEW.status = 'DONE' THEN NEW.updated_at END;
    NEW.cancelled_at := CASE WHEN NEW.status = 'CANCELLED' THEN NEW.updated_at END;
    RETURN NEW;
END $$;