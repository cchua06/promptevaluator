DROP TABLE IF EXISTS prompts;
DROP TABLE IF EXISTS passwords;

CREATE TABLE passwords (
    id TEXT PRIMARY KEY,
    workshop_name TEXT,
    date_of_expiry TIMESTAMP
);

CREATE TABLE prompts (
    id UUID PRIMARY KEY,
    timestamp TEXT,
    firstName TEXT,
    lastName TEXT,
    prompt TEXT,
    notes TEXT,
    facilitatorFeedback TEXT,
    password TEXT
);