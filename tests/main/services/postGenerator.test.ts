import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@main/storage/db";
import { saveProfile } from "@main/storage/styleProfile";
import { addSample } from "@main/storage/samples";
import { listHistory } from "@main/storage/history";
import { runGenerate } from "@main/services/postGenerator";
import type { LLMProvider } from "@main/llm/types";
import type { GenerationResult, GenerateInput } from "@shared/types";

const baseInput: GenerateInput = {
  info: {
    storeName: "X카페", address: "서울", postType: "카페",
    keywords: [], length: 1500, tone: "my_style", emphasis: "",
  },
  memo: "메모",
  images: [
    { filename: "01.jpg", mediaType: "image/jpeg", base64: "AAAA" },
    { filename: "02.jpg", mediaType: "image/jpeg", base64: "BBBB" },
  ],
  useWebSearch: false,
};

const makeProvider = (result: GenerationResult): LLMProvider => ({
  name: "claude",
  validateApiKey: async () => true,
  analyzeStyle: async () => { throw new Error("not used"); },
  generatePost: async () => result,
});

let db: ReturnType<typeof openDatabase>;
beforeEach(() => {
  db = openDatabase(":memory:");
  addSample(db, { label: "a", body: "샘플 1" });
  saveProfile(db, {
    toneDistribution: { 해요: 1 }, avgSentenceLength: 25,
    commonExpressions: [], emojiFrequency: "none",
    structureNotes: "", photoDescriptionStyle: "",
  });
});

describe("runGenerate", () => {
  it("saves to history and returns result + record", async () => {
    const provider = makeProvider({
      title: "T",
      body: "본문 [사진1] 중간 [사진2]" + "가".repeat(1450),
      hashtags: ["x"],
      imageMap: { "사진1": "01.jpg", "사진2": "02.jpg" },
    });
    const { result, record, warnings } = await runGenerate(db, provider, baseInput);
    expect(result.title).toBe("T");
    expect(record.storeName).toBe("X카페");
    expect(warnings).toHaveLength(0);
    expect(listHistory(db)).toHaveLength(1);
  });

  it("warns when markers are missing", async () => {
    const provider = makeProvider({
      title: "T", body: "[사진1] 짧은 본문", hashtags: [],
      imageMap: { "사진1": "01.jpg", "사진2": "02.jpg" },
    });
    const { warnings } = await runGenerate(db, provider, baseInput);
    expect(warnings.some((w) => w.includes("사진2"))).toBe(true);
  });

  it("warns when length is far off target", async () => {
    const provider = makeProvider({
      title: "T", body: "짧음 [사진1] [사진2]", hashtags: [],
      imageMap: { "사진1": "01.jpg", "사진2": "02.jpg" },
    });
    const { warnings } = await runGenerate(db, provider, baseInput);
    expect(warnings.some((w) => w.includes("글자수"))).toBe(true);
  });

  it("throws when style profile missing", async () => {
    const empty = openDatabase(":memory:");
    await expect(
      runGenerate(empty, makeProvider({} as GenerationResult), baseInput),
    ).rejects.toThrow();
  });
});
