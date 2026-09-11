--liquibase formatted sql
--changeset team:2 splitStatements:true endDelimiter:;

-- Шаг 1: Добавляем колонку и внешний ключ
ALTER TABLE reactions
    ADD COLUMN "operator" BIGINT NOT NULL,
    ADD CONSTRAINT fk_operator_users
        FOREIGN KEY ("operator")
        REFERENCES users(id)
        ON DELETE CASCADE;

-- Шаг 2: Безопасно преобразуем одиночное значение в массив
ALTER TABLE reactions 
    ALTER COLUMN reason TYPE reason[] USING ARRAY[reason];
