import type { Database } from "better-sqlite3";
import { randomUUID } from "crypto";
import type { HistoryRecord, PostType } from "@shared/types";

interface SaveInput {
  storeName: string;
  address: string | null;
  postType: PostType;
  title: string;
  body: string;
  hashtags: string[];
  imageMap: Record<string, string>;
}

interface Row {
  id: string;
  store_name: string;
  address: string | null;
  post_type: PostType;
  title: string;
  body: string;
  hashtags: string;
  image_map: string;
  created_at: string;
}

const toRecord = (r: Row): HistoryRecord => ({
  id: r.id,
  storeName: r.store_name,
  address: r.address ?? undefined,
  postType: r.post_type,
  title: r.title,
  body: r.body,
  hashtags: JSON.parse(r.hashtags),
  imageMap: JSON.parse(r.image_map),
  createdAt: r.created_at,
});

export function saveGeneration(db: Database, input: SaveInput): HistoryRecord {
  const id = randomUUID().slice(0, 12);
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO generations (id, store_name, address, post_type, title, body, hashtags, image_map, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.storeName,
    input.address,
    input.postType,
    input.title,
    input.body,
    JSON.stringify(input.hashtags),
    JSON.stringify(input.imageMap),
    createdAt,
  );
  return {
    id,
    storeName: input.storeName,
    address: input.address ?? undefined,
    postType: input.postType,
    title: input.title,
    body: input.body,
    hashtags: input.hashtags,
    imageMap: input.imageMap,
    createdAt,
  };
}

export function listHistory(db: Database): HistoryRecord[] {
  const rows = db
    .prepare("SELECT * FROM generations ORDER BY created_at DESC")
    .all() as Row[];
  return rows.map(toRecord);
}

export function getHistory(db: Database, id: string): HistoryRecord | null {
  const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? toRecord(row) : null;
}

export function deleteHistory(db: Database, id: string): void {
  db.prepare("DELETE FROM generations WHERE id = ?").run(id);
}
