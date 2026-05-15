import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "@main/storage/db";
import { addSample, listSamples, deleteSample, getAllBodies } from "@main/storage/samples";

let db: Database;
beforeEach(() => {
  db = openDatabase(":memory:");
});

describe("samples", () => {
  it("add then list returns the sample", () => {
    const s = addSample(db, { label: "테스트", body: "본문" });
    expect(s.label).toBe("테스트");
    expect(s.charCount).toBe(2);
    const all = listSamples(db);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(s.id);
  });

  it("list returns samples newest-first", async () => {
    addSample(db, { label: "A", body: "a" });
    await new Promise((r) => setTimeout(r, 5));
    addSample(db, { label: "B", body: "b" });
    const all = listSamples(db);
    expect(all.map((s) => s.label)).toEqual(["B", "A"]);
  });

  it("delete removes the sample", () => {
    const s = addSample(db, { label: "X", body: "x" });
    deleteSample(db, s.id);
    expect(listSamples(db)).toHaveLength(0);
  });

  it("getAllBodies returns just body text in stable order", () => {
    addSample(db, { label: "A", body: "글A" });
    addSample(db, { label: "B", body: "글B" });
    const bodies = getAllBodies(db);
    expect(bodies).toHaveLength(2);
    expect(bodies).toContain("글A");
    expect(bodies).toContain("글B");
  });
});
