import { openDatabase } from "./storage/db";
import { getDbPath } from "./storage/settings";
import type { Database } from "better-sqlite3";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = openDatabase(getDbPath());
  }
  return _db;
}

export function reopenDb(): void {
  if (_db) {
    try { _db.close(); } catch (e) { console.warn("db close failed", e); }
    _db = null;
  }
  _db = openDatabase(getDbPath());
}
