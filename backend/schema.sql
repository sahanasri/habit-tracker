CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE auth_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE TABLE habits (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color VARCHAR(7) NOT NULL DEFAULT '#19785b',
    icon VARCHAR(32) NOT NULL DEFAULT 'check',
    target_days_per_week INTEGER NOT NULL DEFAULT 7 CHECK (target_days_per_week BETWEEN 1 AND 7),
    is_archived BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL
);

CREATE TABLE habit_completions (
    id INTEGER PRIMARY KEY,
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    completed_on DATE NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE (habit_id, completed_on)
);

CREATE TABLE habit_notes (
    id INTEGER PRIMARY KEY,
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    noted_on DATE NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL
);

CREATE INDEX ix_habit_completions_date ON habit_completions(completed_on);
CREATE INDEX ix_habit_notes_date ON habit_notes(noted_on);
CREATE INDEX ix_habits_user_id ON habits(user_id);
CREATE INDEX ix_auth_sessions_user_id ON auth_sessions(user_id);
