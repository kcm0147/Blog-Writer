import { describe, it, expect } from "vitest";
import {
  buildAnalyzeSystemPrompt,
  buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt,
  buildGenerateUserPrompt,
} from "@main/llm/prompts";
import type { StyleProfile } from "@shared/types";

const PROFILE: StyleProfile = {
  toneDistribution: { 해요: 0.8, 합니다: 0.2 },
  avgSentenceLength: 30,
  commonExpressions: ["진짜", "완전"],
  emojiFrequency: "low",
  structureNotes: "도입-본문-마무리",
  photoDescriptionStyle: "감성",
  sourceHash: "x", sampleCount: 10, updatedAt: "2026-05-15T00:00:00.000Z",
};

describe("prompts", () => {
  it("analyze system prompt asks for JSON", () => {
    expect(buildAnalyzeSystemPrompt()).toContain("JSON");
  });

  it("analyze user prompt embeds samples", () => {
    const p = buildAnalyzeUserPrompt(["글1", "글2"]);
    expect(p).toContain("글1");
    expect(p).toContain("글2");
  });

  it("generate system prompt embeds profile fields", () => {
    const p = buildGenerateSystemPrompt(PROFILE);
    expect(p).toContain("진짜");
    expect(p).toContain("도입-본문-마무리");
  });

  it("generate user prompt contains store, length and markers", () => {
    const p = buildGenerateUserPrompt({
      info: {
        storeName: "X카페", address: "서울", postType: "카페",
        keywords: [], length: 1500, tone: "my_style", emphasis: "",
      },
      memo: "좋은 곳",
      images: [],
      useWebSearch: false,
    }, ["사진1", "사진2"]);
    expect(p).toContain("X카페");
    expect(p).toContain("1500");
    expect(p).toContain("[사진1]");
    expect(p).toContain("[사진2]");
  });
});
