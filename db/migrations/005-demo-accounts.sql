--liquibase formatted sql
--changeset team:5
-- Explicitly provisioned test identities, never existing real accounts.
CREATE TABLE demo_accounts (
    role TEXT PRIMARY KEY CHECK (role IN ('admin', 'supportL1', 'supportL2', 'supportL3', 'user')),
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id)
);
