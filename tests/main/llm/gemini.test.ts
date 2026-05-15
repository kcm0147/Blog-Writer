import { describe, it, expect, vi } from "vitest";

const mockGenerate = vi.fn();
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: (req: unknown) => mockGenerate(req),
    }),
  })),
}));

import { GeminiProvider } from "@main/llm/gemini";

const PROFILE = {
  toneDistribution: { 해요: 1 }, avgSentenceLength: 25,
  commonExpressions: [], emojiFrequency: "none" as const,
  structureNotes: "", photoDescriptionStyle: "",
  sourceHash: "x", sampleCount: 5, updatedAt: "2026-05-15T00:00:00Z",
};

describe("GeminiProvider", () => {
  it("analyzeStyle parses JSON response", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({
        toneDistribution: { 해요: 1.0 }, avgSentenceLength: 28,
        commonExpressions: ["완전"], emojiFrequency: "medium",
        structureNotes: "X", photoDescriptionStyle: "Y",
      }) },
    });
    const p = new GeminiProvider("g-test");
    const r = await p.analyzeStyle(["글1"]);
    expect(r.commonExpressions).toEqual(["완전"]);
  });

  it("generatePost sends inline image data and parses result", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({
        title: "T", body: "B [사진1]", hashtags: ["a"],
      }) },
    });
    const p = new GeminiProvider("g-test");
    const r = await p.generatePost({
      profile: PROFILE,
      input: {
        info: {
          storeName: "S", address: "A", postType: "카페",
          keywords: [], length: 1500, tone: "my_style", emphasis: "",
        },
        memo: "", useWebSearch: false,
        images: [{ filename: "a.jpg", mediaType: "image/jpeg", base64: "AAAA" }],
      },
      imageMarkers: ["사진1"],
    });
    expect(r.title).toBe("T");
    expect(r.imageMap["사진1"]).toBe("a.jpg");

    const arg = mockGenerate.mock.calls[0]![0] as { contents: Array<{ parts: Array<{ inlineData?: unknown }> }> };
    const parts = arg.contents[0]!.parts;
    const inline = parts.find((p) => p.inlineData);
    expect(inline).toBeTruthy();
  });
});
