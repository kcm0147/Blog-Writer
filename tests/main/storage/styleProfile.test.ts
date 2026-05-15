import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "@main/storage/db";
import { addSample } from "@main/storage/samples";
import {
  computeSamplesHash,
  saveProfile,
  loadProfile,
  loadProfileIfFresh,
} from "@main/storage/styleProfile";
import type { StyleProfileCore } from "@shared/types";

const CORE: StyleProfileCore = {
  toneDistribution: { 해요: 1.0 },
  avgSentenceLength: 30,
  commonExpressions: ["진짜"],
  emojiFrequency: "low",
  structureNotes: "도입-본문-마무리",
  photoDescriptionStyle: "감성",
};

let db: Database;
beforeEach(() => {
  db = openDatabase(":memory:");
});

describe("styleProfile", () => {
  it("computeSamplesHash changes with content", () => {
    addSample(db, { label: "a", body: "글1" });
    const h1 = computeSamplesHash(db);
    addSample(db, { label: "b", body: "글2" });
    const h2 = computeSamplesHash(db);
    expect(h1).not.toBe(h2);
  });

  it("save then load returns the profile", () => {
    addSample(db, { label: "a", body: "글1" });
    const saved = saveProfile(db, CORE);
    const loaded = loadProfile(db);
    expect(loaded).not.toBeNull();
    expect(loaded!.sourceHash).toBe(saved.sourceHash);
    expect(loaded!.commonExpressions).toEqual(["진짜"]);
  });

  it("loadProfileIfFresh returns null after samples change", () => {
    addSample(db, { label: "a", body: "글1" });
    saveProfile(db, CORE);
    addSample(db, { label: "b", body: "추가" });
    expect(loadProfileIfFresh(db)).toBeNull();
  });
});
