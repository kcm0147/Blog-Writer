import Database, { Database as DB } from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS style_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  address TEXT,
  post_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hashtags TEXT NOT NULL,
  image_map TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function openDatabase(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
