--liquibase formatted sql
--changeset team:7
-- Preserve legacy AI dislikes with unknown reasons; enforce the shared rule on
-- every new/edited reaction without inventing historical user choices.
ALTER TABLE reactions ADD CONSTRAINT reactions_all_negative_reasons
    CHECK ("like" OR coalesce(cardinality(reasons), 0) > 0) NOT VALID;
