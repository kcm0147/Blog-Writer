import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "@main/storage/db";
import {
  saveGeneration,
  listHistory,
  getHistory,
  deleteHistory,
} from "@main/storage/history";

let db: Database;
beforeEach(() => {
  db = openDatabase(":memory:");
});

describe("history", () => {
  it("save + get round-trip", () => {
    const rec = saveGeneration(db, {
      storeName: "X카페",
      address: "서울",
      postType: "카페",
      title: "제목",
      body: "본문 [사진1]",
      hashtags: ["#x"],
      imageMap: { 사진1: "01.jpg" },
    });
    const got = getHistory(db, rec.id);
    expect(got).not.toBeNull();
    expect(got!.title).toBe("제목");
    expect(got!.imageMap["사진1"]).toBe("01.jpg");
    expect(got!.hashtags).toEqual(["#x"]);
  });

  it("list newest first + delete", async () => {
    const a = saveGeneration(db, {
      storeName: "A",
      address: null,
      postType: "맛집",
      title: "A제목",
      body: "",
      hashtags: [],
      imageMap: {},
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = saveGeneration(db, {
      storeName: "B",
      address: null,
      postType: "맛집",
      title: "B제목",
      body: "",
      hashtags: [],
      imageMap: {},
    });
    expect(listHistory(db).map((h) => h.id)).toEqual([b.id, a.id]);
    deleteHistory(db, a.id);
    expect(listHistory(db).map((h) => h.id)).toEqual([b.id]);
  });
});
