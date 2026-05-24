#!/usr/bin/env python3
"""
Initialize the attractions SQLite database.
Run once before scraping: python3 scripts/init_db.py
"""

import sqlite3
import pathlib

DB_PATH = pathlib.Path(__file__).parent.parent / "data" / "attractions.db"

def init():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")  # allow concurrent reads while writing
    con.executescript("""
        CREATE TABLE IF NOT EXISTS attractions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            city          TEXT NOT NULL COLLATE NOCASE,
            country       TEXT,
            name          TEXT NOT NULL,
            type          TEXT,   -- trail | lake | museum | neighbourhood | viewpoint | beach | other
            duration_min  INTEGER,  -- minutes, minimum realistic visit
            duration_max  INTEGER,  -- minutes, full experience
            difficulty    TEXT,   -- easy | moderate | hard | N/A
            distance_km   REAL,   -- for trails
            highlights    TEXT,   -- JSON array of strings
            best_for      TEXT,   -- JSON array: solo | couples | families | off-beaten-path | photography
            crowd_level   TEXT,   -- low | moderate | high
            nearby        TEXT,   -- JSON array of nearby attraction names (within ~30 min)
            tips          TEXT,   -- free text, local tips
            source_url    TEXT,
            confidence    TEXT DEFAULT 'estimated',  -- high | medium | low | estimated
            trending_score INTEGER DEFAULT 0,        -- Wikipedia monthly pageviews (3-month total), 0 if no article
            last_updated  TEXT DEFAULT (date('now')),
            UNIQUE(city, name)
        );

        CREATE TABLE IF NOT EXISTS scrape_queue (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            city        TEXT NOT NULL COLLATE NOCASE,
            country     TEXT,
            status      TEXT NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
            queued_at   TEXT DEFAULT (datetime('now')),
            started_at  TEXT,
            finished_at TEXT,
            error       TEXT,
            UNIQUE(city)
        );

        CREATE INDEX IF NOT EXISTS idx_attractions_city ON attractions(city);
        CREATE INDEX IF NOT EXISTS idx_queue_status    ON scrape_queue(status);
    """)
    con.commit()

    # Migrations — safe to run on existing DBs
    try:
        con.execute("ALTER TABLE attractions ADD COLUMN trending_score INTEGER DEFAULT 0")
        con.commit()
        print("Migration: added trending_score column")
    except sqlite3.OperationalError:
        pass  # column already exists

    con.close()
    print(f"Database initialised at {DB_PATH}")

if __name__ == "__main__":
    init()
