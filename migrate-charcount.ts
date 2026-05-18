import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";

// 임시 스크립트: app.getPath("userData")는 CLI 환경에선 안 돌 수 있음. 직접 경로 지정.
const dbPath = "/Users/mook/Library/Application Support/naver-blog-writer/naver-blog-writer.db";
const db = new Database(dbPath);

console.log("Starting DB migration for char_count...");

const rows = db.prepare("SELECT id, body, char_count FROM samples").all() as any[];

let updated = 0;
const stmt = db.prepare("UPDATE samples SET char_count = ? WHERE id = ?");

for (const row of rows) {
  const pureCount = row.body.replace(/\s/g, '').length;
  if (row.char_count !== pureCount) {
    stmt.run(pureCount, row.id);
    updated++;
  }
}

console.log(`Migration complete. Updated ${updated} rows.`);
db.close();
