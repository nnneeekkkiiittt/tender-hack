--liquibase formatted sql
--changeset team:4

ALTER TABLE claims
ADD COLUMN created_at TIMESTAMP NOT NULL,
ADD COLUMN resolved_at TIMESTAMP;