import type { Database } from "better-sqlite3";
import { randomUUID } from "crypto";

export interface DraftPayload {
  storeName: string;
  address: string;
  visitDate: string;
  postType: string;
  postTypeExtra: string;
  title: string;
  keywords: string[];
  length: number;
  tone: string;
  emphasis: string;
  memo: string;
  images: Array<{ filename: string; mediaType: string; base64: string }>;
}

export interface DraftSummary {
  id: string;
  label: string;
  storeName: string | null;
  postType: string | null;
  updatedAt: string;
}

export interface Draft extends DraftSummary {
  payload: DraftPayload;
}

interface Row {
  id: string;
  label: string;
  payload: string;
  store_name: string | null;
  post_type: string | null;
  updated_at: string;
}

interface SummaryRow {
  id: string;
  label: string;
  store_name: string | null;
  post_type: string | null;
  updated_at: string;
}

export function saveDraft(
  db: Database,
  input: { id?: string; label: string; payload: DraftPayload },
): Draft {
  const id = input.id ?? randomUUID();
  const updatedAt = new Date().toISOString();
  const storeName = input.payload.storeName || null;
  const postType = input.payload.postType || null;
  db.prepare(
    `INSERT INTO drafts (id, label, payload, store_name, post_type, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label=excluded.label, payload=excluded.payload,
       store_name=excluded.store_name, post_type=excluded.post_type, updated_at=excluded.updated_at`,
  ).run(id, input.label, JSON.stringify(input.payload), storeName, postType, updatedAt);
  return { id, label: input.label, storeName, postType, updatedAt, payload: input.payload };
}

export function listDrafts(db: Database): DraftSummary[] {
  const rows = db.prepare(
    "SELECT id, label, store_name, post_type, updated_at FROM drafts ORDER BY updated_at DESC",
  ).all() as SummaryRow[];
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    storeName: r.store_name,
    postType: r.post_type,
    updatedAt: r.updated_at,
  }));
}

export function getDraft(db: Database, id: string): Draft | null {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(id) as
    | Row
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    storeName: row.store_name,
    postType: row.post_type,
    updatedAt: row.updated_at,
    payload: JSON.parse(row.payload) as DraftPayload,
  };
}

export function deleteDraft(db: Database, id: string): void {
  db.prepare("DELETE FROM drafts WHERE id = ?").run(id);
}
