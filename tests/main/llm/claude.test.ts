import { describe, it, expect, vi } from "vitest";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: (args: unknown) => mockCreate(args) },
  })),
}));

import { ClaudeProvider } from "@main/llm/claude";

const PROFILE = {
  toneDistribution: { 해요: 1 }, avgSentenceLength: 25,
  commonExpressions: [], emojiFrequency: "none" as const,
  structureNotes: "", photoDescriptionStyle: "",
  sourceHash: "x", sampleCount: 5, updatedAt: "2026-05-15T00:00:00Z",
};

describe("ClaudeProvider", () => {
  it("analyzeStyle parses JSON response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        toneDistribution: { 해요: 1.0 },
        avgSentenceLength: 30,
        commonExpressions: ["진짜"],
        emojiFrequency: "low",
        structureNotes: "S",
        photoDescriptionStyle: "P",
      }) }],
    });
    const p = new ClaudeProvider("sk-test");
    const result = await p.analyzeStyle(["글1", "글2"]);
    expect(result.commonExpressions).toEqual(["진짜"]);
  });

  it("generatePost sends image blocks and parses result", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        title: "T", body: "B [사진1]", hashtags: ["x"],
      }) }],
    });
    const p = new ClaudeProvider("sk-test");
    const result = await p.generatePost({
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
    expect(result.title).toBe("T");
    expect(result.imageMap).toEqual({ "사진1": "a.jpg" });

    const calledWith = mockCreate.mock.calls[0]![0] as { messages: Array<{ content: Array<{ type: string }> }> };
    const content = calledWith.messages[0]!.content;
    const imageBlock = content.find((b) => b.type === "image");
    expect(imageBlock).toBeTruthy();
  });

  it("strips code fences from response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '```json\n{"title":"T","body":"B","hashtags":[]}\n```' }],
    });
    const p = new ClaudeProvider("sk-test");
    const r = await p.generatePost({
      profile: PROFILE,
      input: {
        info: {
          storeName: "S", address: "A", postType: "카페",
          keywords: [], length: 1500, tone: "my_style", emphasis: "",
        },
        memo: "", useWebSearch: false, images: [],
      },
      imageMarkers: [],
    });
    expect(r.title).toBe("T");
  });
});
