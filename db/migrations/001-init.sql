--liquibase formatted sql
--changeset team:1

CREATE TYPE user_role AS ENUM ('admin', 'supportL1', 'supportL2', 'supportL3', 'user');
CREATE TYPE status AS ENUM ('NEW', 'IN WORK', 'CANCELLED', 'DONE');
CREATE TYPE reason AS ENUM ('SLOW WORK', 'INCORRECT ANSWER', 'IRRELEVANT ANSWER', 'RUDE BEHAVIOUR');

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL CHECK (name = btrim(name) AND name <> ''),
    role user_role NOT NULL,
    hash VARCHAR(255) NOT NULL,
    auth_version BIGINT NOT NULL DEFAULT 0 CHECK (auth_version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX users_username_unique ON users(lower(name));

CREATE TABLE claims (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL CHECK (btrim(title) <> ''),
    topic VARCHAR(255) NOT NULL DEFAULT 'OTHER',
    subtopic VARCHAR(255),
    status status NOT NULL DEFAULT 'NEW',
    operator_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    assigned_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    UNIQUE (id, author_id),
    CHECK ((status = 'NEW' AND operator_id IS NULL) OR
           (status IN ('IN WORK', 'DONE') AND operator_id IS NOT NULL) OR status = 'CANCELLED'),
    CHECK ((operator_id IS NULL) = (assigned_at IS NULL)),
    CHECK ((status = 'DONE') = (resolved_at IS NOT NULL)),
    CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);

CREATE TABLE messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL REFERENCES claims(id),
    author BIGINT REFERENCES users(id),
    author_kind TEXT NOT NULL CHECK (author_kind IN ('USER', 'SUPPORT', 'ADMIN', 'AI', 'SYSTEM')),
    text TEXT NOT NULL CHECK (btrim(text) <> ''),
    metadata JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK ((author_kind IN ('USER', 'SUPPORT', 'ADMIN') AND author IS NOT NULL) OR
           (author_kind IN ('AI', 'SYSTEM') AND author IS NULL))
);

CREATE TABLE reactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL,
    "operator" BIGINT NOT NULL REFERENCES users(id),
    submitted_by BIGINT NOT NULL REFERENCES users(id),
    "like" BOOLEAN NOT NULL,
    reason reason[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (claim_id, "operator"),
    FOREIGN KEY (claim_id, submitted_by) REFERENCES claims(id, author_id),
    CHECK (("like" AND coalesce(cardinality(reason), 0) = 0) OR
           (NOT "like" AND coalesce(cardinality(reason), 0) > 0 AND array_position(reason, NULL) IS NULL))
);

-- Optional per-message feedback storage; no AI-answer feedback UI in v1.
CREATE TABLE message_feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id),
    submitted_by BIGINT NOT NULL REFERENCES users(id),
    helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (message_id, submitted_by)
);

CREATE INDEX claims_author_idx ON claims(author_id, id DESC);
CREATE INDEX claims_operator_idx ON claims(operator_id, status, id DESC);
CREATE INDEX claims_status_idx ON claims(status, id DESC);
CREATE INDEX claims_topic_idx ON claims(topic);
CREATE INDEX messages_timeline_idx ON messages(claim_id, sent_at, id);
CREATE INDEX messages_author_idx ON messages(author);
CREATE INDEX reactions_operator_idx ON reactions("operator");
CREATE INDEX reactions_submitter_idx ON reactions(submitted_by);
CREATE INDEX message_feedback_submitter_idx ON message_feedback(submitted_by);
