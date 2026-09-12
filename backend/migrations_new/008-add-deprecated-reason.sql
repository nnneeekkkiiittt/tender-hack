-- Adds the 5th dislike reason. Postgres enum values can only be added, never
-- removed/renamed in place — run this as its own statement (not batched
-- inside a larger transaction with code that immediately uses the new value).
ALTER TYPE reason ADD VALUE IF NOT EXISTS 'DEPRECATED KNOWLEDGE BASE';
