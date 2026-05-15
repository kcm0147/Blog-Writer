import type { Database } from "better-sqlite3";
import { createHash } from "crypto";
import type { StyleProfile, StyleProfileCore } from "@shared/types";

export function computeSamplesHash(db: Database): string {
  const rows = db
    .prepare("SELECT id, body FROM samples ORDER BY id ASC")
    .all() as { id: string; body: string }[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(r.id);
    h.update("\0");
    h.update(r.body);
    h.update("\0");
  }
  return h.digest("hex");
}

export function saveProfile(
  db: Database,
  core: StyleProfileCore,
): StyleProfile {
  const sourceHash = computeSamplesHash(db);
  const sampleCount = (
    db.prepare("SELECT COUNT(*) as c FROM samples").get() as { c: number }
  ).c;
  const updatedAt = new Date().toISOString();
  const profile: StyleProfile = { ...core, sourceHash, sampleCount, updatedAt };
  db.prepare(
    `INSERT INTO style_profile (id, json, source_hash, sample_count, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET json=excluded.json, source_hash=excluded.source_hash,
       sample_count=excluded.sample_count, updated_at=excluded.updated_at`,
  ).run(JSON.stringify(profile), sourceHash, sampleCount, updatedAt);
  return profile;
}

export function loadProfile(db: Database): StyleProfile | null {
  const row = db
    .prepare("SELECT json FROM style_profile WHERE id = 1")
    .get() as { json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.json) as StyleProfile;
}

export function loadProfileIfFresh(db: Database): StyleProfile | null {
  const profile = loadProfile(db);
  if (!profile) return null;
  if (profile.sourceHash !== computeSamplesHash(db)) return null;
  return profile;
}
