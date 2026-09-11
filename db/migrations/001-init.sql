CREATE TYPE user_role AS ENUM (
    'admin',
    'supportL1',
    'supportL2',
    'supportL3',
    'user'
);

CREATE TYPE status AS ENUM (
    'NEW',
    'IN WORK',
    'CANCELLED',
    'DONE'
);

CREATE TYPE reason AS ENUM (
    'SLOW WORK',
    'INCORRECT ANSWER',
    'IRRELEVANT ANSWER',
    'RUDE BEHAVIOUR'
);

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role role NOT NULL,
    hash VARCHAR(255) NOT NULL
);

CREATE TABLE claims (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    topic VARCHAR(255),
    subtopic VARCHAR(255),
    status status NOT NULL,
    operator_id BIGINT[],

    CONSTRAINT fk_claims_author
        FOREIGN KEY (author_id)
        REFERENCES users(id)
);

CREATE TABLE messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL,

    CONSTRAINT fk_messages_claim
        FOREIGN KEY (claim_id)
        REFERENCES claims(id)
        ON DELETE CASCADE
);

CREATE TABLE reactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id BIGINT NOT NULL,
    "like" BOOLEAN NOT NULL,
    reason reason,

    CONSTRAINT fk_reactions_claim
        FOREIGN KEY (claim_id)
        REFERENCES claims(id)
        ON DELETE CASCADE
);

