import type { Database } from "better-sqlite3";
import { createHash, randomUUID } from "crypto";
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

  // 분석 기록 히스토리에 누적 보관
  db.prepare(
    `INSERT INTO style_profile_history (id, json, created_at) VALUES (?, ?, ?)`
  ).run(randomUUID(), JSON.stringify(profile), updatedAt);

  return profile;
}

export function updateProfile(db: Database, updated: StyleProfile): StyleProfile {
  updated.updatedAt = new Date().toISOString();
  db.prepare(
    `UPDATE style_profile SET json=?, updated_at=? WHERE id=1`
  ).run(JSON.stringify(updated), updated.updatedAt);

  // 수동 편집 내용도 히스토리에 보관
  db.prepare(
    `INSERT INTO style_profile_history (id, json, created_at) VALUES (?, ?, ?)`
  ).run(randomUUID(), JSON.stringify(updated), updated.updatedAt);
  
  return updated;
}

export function listProfileHistory(db: Database): Array<{ id: string; createdAt: string; profileInfo: any }> {
  const rows = db.prepare(`SELECT id, json, created_at FROM style_profile_history ORDER BY created_at DESC`).all() as any[];
  return rows.map((r) => {
    const p = JSON.parse(r.json) as StyleProfile;
    // 프론트엔드 모달에 띄울 간략 정보(어투 등)만 추출해서 넘김
    return {
      id: r.id,
      createdAt: r.created_at,
      profileInfo: {
        toneDistribution: p.toneDistribution,
        sampleCount: p.sampleCount,
        commonExpressions: p.commonExpressions?.slice(0, 3) || [],
        primaryColor: p.formatting?.primaryColor || null,
        highlightColor: p.formatting?.highlightColor || null,
      }
    };
  });
}

export function restoreProfileHistory(db: Database, id: string): StyleProfile {
  const row = db.prepare(`SELECT json FROM style_profile_history WHERE id = ?`).get(id) as { json: string } | undefined;
  if (!row) throw new Error("해당 스타일 기록을 찾을 수 없습니다.");
  
  const profile = JSON.parse(row.json) as StyleProfile;
  profile.updatedAt = new Date().toISOString();
  
  // 현재 운영 프로파일로 덮어쓰기
  db.prepare(
    `UPDATE style_profile SET json=?, sample_count=?, source_hash=?, updated_at=? WHERE id=1`
  ).run(JSON.stringify(profile), profile.sampleCount, profile.sourceHash, profile.updatedAt);
  
  // 히스토리에 복구 기록 새롭게 한 번 더 남기기
  db.prepare(
    `INSERT INTO style_profile_history (id, json, created_at) VALUES (?, ?, ?)`
  ).run(randomUUID(), JSON.stringify(profile), profile.updatedAt);

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
