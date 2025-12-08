-- Migration number: 0001 	 2024-04-05T00:00:00.000Z
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pathname TEXT NOT NULL,
    helpful INTEGER NOT NULL, -- 1 for yes, 0 for no
    created_at TEXT NOT NULL
);
