import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@main/storage/db";
import { addSample } from "@main/storage/samples";
import { loadProfile } from "@main/storage/styleProfile";
import { runAnalyze, MIN_SAMPLES_WARN } from "@main/services/styleAnalyzer";
import type { LLMProvider } from "@main/llm/types";

const fakeProvider = (): LLMProvider => ({
  name: "claude",
  validateApiKey: async () => true,
  analyzeStyle: async () => ({
    toneDistribution: { 해요: 1 },
    avgSentenceLength: 25,
    commonExpressions: ["진짜"],
    emojiFrequency: "low",
    structureNotes: "",
    photoDescriptionStyle: "",
  }),
  generatePost: async () => { throw new Error("not used"); },
});

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(":memory:"); });

describe("runAnalyze", () => {
  it("throws when no samples", async () => {
    await expect(runAnalyze(db, fakeProvider())).rejects.toThrow();
  });

  it("saves profile with sourceHash and sampleCount", async () => {
    for (let i = 0; i < 6; i++) addSample(db, { label: `${i}`, body: `글${i}` });
    const profile = await runAnalyze(db, fakeProvider());
    expect(profile.sampleCount).toBe(6);
    const loaded = loadProfile(db);
    expect(loaded?.sourceHash).toBe(profile.sourceHash);
  });

  it("includes warning when samples below threshold", async () => {
    for (let i = 0; i < MIN_SAMPLES_WARN - 1; i++) {
      addSample(db, { label: `${i}`, body: `글${i}` });
    }
    const warnings: string[] = [];
    await runAnalyze(db, fakeProvider(), { onWarning: (w) => warnings.push(w) });
    expect(warnings.some((w) => w.includes("5개 미만"))).toBe(true);
  });
});
