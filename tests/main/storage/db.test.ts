import { describe, it, expect } from "vitest";
import { openDatabase } from "@main/storage/db";

describe("openDatabase", () => {
  it("creates required tables", () => {
    const db = openDatabase(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("samples");
    expect(names).toContain("style_profile");
    expect(names).toContain("generations");
    db.close();
  });

  it("is idempotent — second open does not error", () => {
    const db1 = openDatabase(":memory:");
    db1.close();
    const db2 = openDatabase(":memory:");
    db2.close();
  });
});
