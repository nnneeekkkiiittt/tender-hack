--liquibase formatted sql
--changeset team:3;

--step 1: add author field
ALTER TABLE messages
ADD COLUMN author BIGINT NOT NULL,
ADD CONSTRAINT fk_author_users
    FOREIGN KEY ("author")
    REFERENCES users(id)
    ON DELETE CASCADE;


--step 2: add fk
