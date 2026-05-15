import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProvider } from "./types";
import type {
  GenerateInput, GenerationResult, StyleProfile, StyleProfileCore,
} from "@shared/types";
import {
  buildAnalyzeSystemPrompt, buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt, buildGenerateUserPrompt,
} from "./prompts";

const MODEL_NAME = "gemini-2.5-flash";
const FENCE_RE = /^```(?:json)?\s*|\s*```$/gm;

function parseJson<T>(text: string): T {
  const cleaned = text.replace(FENCE_RE, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Gemini JSON 파싱 실패: ${(e as Error).message}\n원문: ${text.slice(0, 300)}`);
  }
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: MODEL_NAME });
      await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 8 },
      });
      return true;
    } catch {
      return false;
    }
  }

  async analyzeStyle(samples: string[]): Promise<StyleProfileCore> {
    const model = this.client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: buildAnalyzeSystemPrompt(),
      generationConfig: { responseMimeType: "application/json" },
    });
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: buildAnalyzeUserPrompt(samples) }] }],
    });
    return parseJson<StyleProfileCore>(res.response.text());
  }

  async generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];
  }): Promise<GenerationResult> {
    const { profile, input, imageMarkers } = args;
    const model = this.client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: buildGenerateSystemPrompt(profile),
      generationConfig: { responseMimeType: "application/json" },
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    for (const img of input.images) {
      parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
    }
    parts.push({ text: buildGenerateUserPrompt(input, imageMarkers) });

    const res = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    const raw = parseJson<{ title: string; body: string; hashtags: string[] }>(
      res.response.text(),
    );

    const imageMap: Record<string, string> = {};
    input.images.forEach((img, i) => {
      imageMap[`사진${i + 1}`] = img.filename;
    });

    return {
      title: raw.title,
      body: raw.body,
      hashtags: raw.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
      imageMap,
    };
  }
}
