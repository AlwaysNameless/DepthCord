CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL,
    scheduled_start INTEGER NOT NULL,
    time_raw TEXT,
    discord_event_id TEXT,
    roster_json TEXT
);

CREATE TABLE IF NOT EXISTS registry (
    entity_id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    alignment TEXT NOT NULL,
    reason TEXT,
    added_by TEXT,
    proof_url TEXT,
    created_at INTEGER
);