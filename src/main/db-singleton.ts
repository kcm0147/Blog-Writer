import { app } from "electron";
import { join } from "path";
import { openDatabase } from "./storage/db";
import type { Database } from "better-sqlite3";

let _db: Database | null = null;
export function getDb(): Database {
  if (!_db) {
    const path = join(app.getPath("userData"), "naver-blog-writer.db");
    _db = openDatabase(path);
  }
  return _db;
}
