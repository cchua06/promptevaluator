DROP TABLE IF EXISTS prompts;
CREATE TABLE prompts (
    id UUID PRIMARY KEY,
    timestamp TEXT,
    firstName TEXT,
    lastName TEXT,
    prompt TEXT,
    notes TEXT,
    facilitatorFeedback TEXT
);