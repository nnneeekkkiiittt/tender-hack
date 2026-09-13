--liquibase formatted sql
--changeset team:12 splitStatements:false

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users(deleted_at) WHERE deleted_at IS NULL;
