--liquibase formatted sql
--changeset team:2 splitStatements:false

CREATE TABLE claim_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL REFERENCES claims(id),
    actor_id BIGINT REFERENCES users(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    before_state JSONB,
    after_state JSONB NOT NULL
);
CREATE INDEX claim_events_timeline_idx ON claim_events(claim_id, occurred_at, id);
CREATE INDEX claim_events_time_idx ON claim_events(occurred_at, id);

CREATE FUNCTION prepare_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'NEW' OR NEW.operator_id IS NOT NULL THEN
            RAISE EXCEPTION 'Claims must start NEW and unassigned' USING ERRCODE = '23514';
        END IF;
    ELSE
        IF OLD.status IN ('DONE', 'CANCELLED') THEN
            RAISE EXCEPTION 'Terminal claims are read-only' USING ERRCODE = '23514';
        END IF;
        IF ROW(NEW.author_id, NEW.created_at)
            IS DISTINCT FROM ROW(OLD.author_id, OLD.created_at) THEN
            RAISE EXCEPTION 'Claim identity is immutable' USING ERRCODE = '23514';
        END IF;
        IF (OLD.status = 'NEW' AND NEW.status = 'DONE') OR (OLD.status = 'IN WORK' AND NEW.status = 'NEW') THEN
            RAISE EXCEPTION 'Invalid claim transition' USING ERRCODE = '23514';
        END IF;
        NEW.assigned_at := CASE WHEN NEW.operator_id IS DISTINCT FROM OLD.operator_id
            THEN clock_timestamp() ELSE OLD.assigned_at END;
    END IF;
    NEW.updated_at := clock_timestamp();
    NEW.resolved_at := CASE WHEN NEW.status = 'DONE' THEN NEW.updated_at END;
    NEW.cancelled_at := CASE WHEN NEW.status = 'CANCELLED' THEN NEW.updated_at END;
    RETURN NEW;
END $$;
CREATE TRIGGER claims_prepare BEFORE INSERT OR UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION prepare_claim();

CREATE FUNCTION record_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO claim_events(claim_id, actor_id, before_state, after_state)
    VALUES (NEW.id, nullif(current_setting('app.actor_id', true), '')::BIGINT,
            CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
    RETURN NEW;
END $$;
CREATE TRIGGER claims_record AFTER INSERT OR UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION record_claim();

CREATE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'History is append-only' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER claim_events_immutable BEFORE UPDATE OR DELETE ON claim_events FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER messages_immutable BEFORE UPDATE OR DELETE ON messages FOR EACH ROW EXECUTE FUNCTION reject_history_change();
