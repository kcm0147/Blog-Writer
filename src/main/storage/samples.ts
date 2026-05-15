import type { Database } from "better-sqlite3";
import { randomUUID } from "crypto";
import type { Sample } from "@shared/types";

interface Row {
  id: string;
  label: string;
  body: string;
  char_count: number;
  created_at: string;
}

const toSample = (r: Row): Sample => ({
  id: r.id,
  label: r.label,
  body: r.body,
  charCount: r.char_count,
  createdAt: r.created_at,
});

export function addSample(
  db: Database,
  { label, body }: { label: string; body: string },
): Sample {
  const id = randomUUID();
  const charCount = body.length;
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO samples (id, label, body, char_count, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, label, body, charCount, createdAt);
  return { id, label, body, charCount, createdAt };
}

export function listSamples(db: Database): Sample[] {
  const rows = db
    .prepare("SELECT * FROM samples ORDER BY created_at DESC")
    .all() as Row[];
  return rows.map(toSample);
}

export function deleteSample(db: Database, id: string): void {
  db.prepare("DELETE FROM samples WHERE id = ?").run(id);
}

export function getAllBodies(db: Database): string[] {
  const rows = db
    .prepare("SELECT body FROM samples ORDER BY id ASC")
    .all() as { body: string }[];
  return rows.map((r) => r.body);
}
