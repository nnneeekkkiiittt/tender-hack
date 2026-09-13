--liquibase formatted sql
--changeset team:10 splitStatements:false

CREATE TABLE IF NOT EXISTS dashboard_templates (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    owner_id              TEXT NOT NULL DEFAULT '',
    widgets               JSONB NOT NULL DEFAULT '[]'::jsonb,
    metabase_dashboard_id BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_templates_owner_id ON dashboard_templates (owner_id);
