--liquibase formatted sql
--changeset team:10

ALTER TYPE reasons ADD VALUE 'DEPRECATED KNOWLEDGE BASE';
ALTER TYPE reasons ADD VALUE 'FORMAL ANSWER'; //типо отписка
ALTER TYPE reasons ADD VALUE 'CONTEXT IGNORING';