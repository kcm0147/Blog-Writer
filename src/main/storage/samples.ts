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

export function getSample(db: Database, id: string): Sample | null {
  const row = db.prepare("SELECT * FROM samples WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? toSample(row) : null;
}

export function updateSample(
  db: Database,
  input: { id: string; label?: string; body?: string },
): Sample {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.label !== undefined) {
    fields.push("label = ?");
    values.push(input.label);
  }
  if (input.body !== undefined) {
    fields.push("body = ?", "char_count = ?");
    values.push(input.body, input.body.length);
  }
  if (fields.length > 0) {
    values.push(input.id);
    db.prepare(`UPDATE samples SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values,
    );
  }
  const updated = getSample(db, input.id);
  if (!updated) throw new Error(`Sample not found: ${input.id}`);
  return updated;
}

export function setSampleHtml(
  db: Database,
  sampleId: string,
  bodyHtml: string,
): void {
  db.prepare(
    `INSERT INTO sample_html (sample_id, body_html) VALUES (?, ?)
     ON CONFLICT(sample_id) DO UPDATE SET body_html = excluded.body_html`,
  ).run(sampleId, bodyHtml);
}

export function getSampleHtml(db: Database, sampleId: string): string | null {
  const row = db
    .prepare("SELECT body_html FROM sample_html WHERE sample_id = ?")
    .get(sampleId) as { body_html: string } | undefined;
  return row?.body_html ?? null;
}

export function listSampleHtmls(db: Database): string[] {
  const rows = db
    .prepare(
      "SELECT body_html FROM sample_html WHERE body_html IS NOT NULL AND body_html != ''",
    )
    .all() as { body_html: string }[];
  return rows.map((r) => r.body_html);
}
