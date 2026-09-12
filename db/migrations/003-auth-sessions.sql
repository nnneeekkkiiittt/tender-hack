--liquibase formatted sql
--changeset team:3 splitStatements:false

CREATE TABLE auth_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    auth_version BIGINT NOT NULL CHECK (auth_version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CHECK (expires_at > created_at)
);
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE FUNCTION revoke_password_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.auth_version := OLD.auth_version + 1;
    UPDATE auth_sessions SET revoked_at = clock_timestamp() WHERE user_id = OLD.id AND revoked_at IS NULL;
    RETURN NEW;
END $$;
CREATE TRIGGER users_password_revoke BEFORE UPDATE OF hash ON users
    FOR EACH ROW WHEN (OLD.hash IS DISTINCT FROM NEW.hash) EXECUTE FUNCTION revoke_password_sessions();
