import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "@main/storage/db";
import {
  addSample, listSamples, deleteSample, getAllBodies,
  updateSample, getSample, setSampleHtml, listSampleHtmls,
} from "@main/storage/samples";

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
    expect(all[0]!.id).toBe(s.id);
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

  it("updateSample replaces label and body, recalculates charCount", () => {
    const s = addSample(db, { label: "old", body: "글" });
    const updated = updateSample(db, { id: s.id, label: "new", body: "더 긴 본문" });
    expect(updated.label).toBe("new");
    expect(updated.body).toBe("더 긴 본문");
    expect(updated.charCount).toBe("더 긴 본문".length);
    expect(getSample(db, s.id)?.label).toBe("new");
  });

  it("updateSample with only label leaves body intact", () => {
    const s = addSample(db, { label: "a", body: "bodybody" });
    const u = updateSample(db, { id: s.id, label: "b" });
    expect(u.body).toBe("bodybody");
    expect(u.label).toBe("b");
  });

  it("setSampleHtml stores html; listSampleHtmls returns it; FK cascades on delete", () => {
    const s = addSample(db, { label: "x", body: "본문" });
    setSampleHtml(db, s.id, "<p>html</p>");
    expect(listSampleHtmls(db)).toEqual(["<p>html</p>"]);
    deleteSample(db, s.id);
    expect(listSampleHtmls(db)).toEqual([]);
  });
});
