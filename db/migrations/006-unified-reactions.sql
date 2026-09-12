--liquibase formatted sql
--changeset team:6 splitStatements:false

ALTER TABLE reactions RENAME COLUMN "operator" TO operator_id;
ALTER TABLE reactions RENAME COLUMN reason TO reasons;
ALTER TABLE reactions ALTER COLUMN operator_id DROP NOT NULL;
ALTER TABLE reactions ADD COLUMN target_kind TEXT NOT NULL DEFAULT 'OPERATOR';
ALTER TABLE reactions ADD COLUMN message_id BIGINT;
ALTER TABLE reactions DROP CONSTRAINT reactions_check;
ALTER TABLE reactions ADD CONSTRAINT reactions_target CHECK (
    (target_kind = 'OPERATOR' AND operator_id IS NOT NULL AND message_id IS NULL) OR
    (target_kind = 'AI_MESSAGE' AND message_id IS NOT NULL AND operator_id IS NULL)
);
ALTER TABLE reactions ADD CONSTRAINT reactions_reasons CHECK (
    ("like" AND coalesce(cardinality(reasons), 0) = 0) OR
    (NOT "like" AND array_position(reasons, NULL) IS NULL AND
        (target_kind = 'AI_MESSAGE' OR coalesce(cardinality(reasons), 0) > 0))
);
ALTER TABLE messages ADD CONSTRAINT messages_id_claim_unique UNIQUE (id, claim_id);
ALTER TABLE reactions ADD CONSTRAINT reactions_message_claim_fk
    FOREIGN KEY (message_id, claim_id) REFERENCES messages(id, claim_id);
ALTER TABLE reactions ADD CONSTRAINT reactions_message_submitter_unique UNIQUE (message_id, submitted_by);

CREATE FUNCTION validate_reaction_target() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.target_kind = 'AI_MESSAGE' AND NOT EXISTS (
        SELECT 1 FROM messages WHERE id = NEW.message_id AND claim_id = NEW.claim_id AND author_kind = 'AI'
    ) THEN
        RAISE EXCEPTION 'AI reactions must target an AI message in this claim' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER reactions_validate_target BEFORE INSERT OR UPDATE ON reactions
    FOR EACH ROW EXECUTE FUNCTION validate_reaction_target();

-- Operator IDs remain unchanged. Legacy AI ratings receive new reaction IDs;
-- their targets, authors, values, and original timestamps are preserved.
INSERT INTO reactions(claim_id, submitted_by, target_kind, message_id, "like", created_at, updated_at)
SELECT m.claim_id, f.submitted_by, 'AI_MESSAGE', f.message_id, f.helpful, f.created_at, f.updated_at
FROM message_feedback f JOIN messages m ON m.id = f.message_id;
DO $$ BEGIN
    IF (SELECT count(*) FROM reactions WHERE target_kind = 'AI_MESSAGE') <> (SELECT count(*) FROM message_feedback) THEN
        RAISE EXCEPTION 'Reaction migration count mismatch';
    END IF;
END $$;
DROP TABLE message_feedback;
