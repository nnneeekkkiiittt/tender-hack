--liquibase formatted sql
--changeset team:9

INSERT INTO users (id, name, role, hash)
OVERRIDING SYSTEM VALUE
VALUES (0, 'AI', 'supportL1', 'this-is-some-hash-for-ai');