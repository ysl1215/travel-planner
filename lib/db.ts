/**
 * Shared SQLite access for Next.js (server-side only).
 *
 * Uses better-sqlite3 (synchronous, ideal for Next.js route handlers).
 * Install: npm install better-sqlite3 && npm install -D @types/better-sqlite3
 *
 * The DB is created by: python3 scripts/init_db.py
 */

import path from "path";
import fs from "fs";

// Lazy-load better-sqlite3 so the module doesn't crash at import time
// if the package isn't installed yet.
let _Database: any = null;
function getDatabase() {
  if (!_Database) {
    try {
      _Database = require("better-sqlite3");
    } catch {
      throw new Error(
        "better-sqlite3 is not installed. Run: npm install better-sqlite3"
      );
    }
  }
  return _Database;
}

const DB_PATH = path.join(process.cwd(), "data", "attractions.db");

let _db: any = null;

export function getDb() {
  if (_db) return _db;
  if (!fs.existsSync(DB_PATH)) return null; // DB not initialised yet — graceful fallback
  const Database = getDatabase();
  _db = new Database(DB_PATH, { readonly: false });
  _db.pragma("journal_mode = WAL");
  return _db;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Attraction {
  id: number;
  city: string;
  country: string;
  name: string;
  type: string;
  duration_min: number | null;
  duration_max: number | null;
  difficulty: string;
  distance_km: number | null;
  highlights: string[];
  best_for: string[];
  crowd_level: string;
  nearby: string[];
  tips: string;
  source_url: string;
  confidence: string;
  trending_score: number;
  last_updated: string;
}

export interface ScrapeQueueRow {
  id: number;
  city: string;
  country: string;
  status: "pending" | "running" | "done" | "failed";
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJsonField(val: string | null, fallback: any[] = []): any[] {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function rowToAttraction(row: any): Attraction {
  return {
    ...row,
    highlights: parseJsonField(row.highlights),
    best_for:   parseJsonField(row.best_for),
    nearby:     parseJsonField(row.nearby),
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Returns all attractions for a city, or [] if city not in index. */
export function getAttractions(city: string): Attraction[] {
  const db = getDb();
  if (!db) return [];
  const rows = db.prepare(
    "SELECT * FROM attractions WHERE city = ? COLLATE NOCASE ORDER BY type, name"
  ).all(city);
  return rows.map(rowToAttraction);
}

/** Returns all rows in the scrape queue. */
export function getScrapeQueue(): ScrapeQueueRow[] {
  const db = getDb();
  if (!db) return [];
  return db.prepare("SELECT * FROM scrape_queue ORDER BY queued_at DESC").all();
}

/** Queue a city for scraping. No-op if already queued. */
export function queueCity(city: string, country: string = ""): void {
  const db = getDb();
  if (!db) return; // DB not initialised — silently skip
  db.prepare(
    "INSERT OR IGNORE INTO scrape_queue (city, country, status) VALUES (?, ?, 'pending')"
  ).run(city, country);
}

/** Returns true if the city has attraction data in the index. */
export function isCityIndexed(city: string): boolean {
  const db = getDb();
  if (!db) return false;
  const row = db.prepare(
    "SELECT 1 FROM attractions WHERE city = ? COLLATE NOCASE LIMIT 1"
  ).get(city);
  return !!row;
}
