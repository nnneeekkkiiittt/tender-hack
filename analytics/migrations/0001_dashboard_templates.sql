-- Custom dashboards ("Мои дашборды"). Widgets are stored as a JSONB
-- configuration, not query results — Metabase re-runs the underlying query
-- against live data every time a dashboard is opened.
--
-- Apply manually against the same database the analytics service connects
-- to, e.g.:
--   psql "$DATABASE_URL" -f migrations/0001_dashboard_templates.sql
-- There is no migration runner in this service yet; this is a plain SQL
-- file rather than inventing a new migration framework for one table.

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
