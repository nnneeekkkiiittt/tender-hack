--liquibase formatted sql
--changeset team:11 runInTransaction:false
ALTER TYPE reason ADD VALUE IF NOT EXISTS 'DEPRECATED KNOWLEDGE BASE';
