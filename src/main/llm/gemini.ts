import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProvider } from "./types";
import type {
  GenerateInput, GenerationResult, StyleProfile, StyleProfileCore,
} from "@shared/types";
import {
  buildAnalyzeSystemPrompt, buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt, buildGenerateUserPrompt,
} from "./prompts";
import { buildImageMap, cleanHashtags, withJsonRetry } from "./utils";

const DEFAULT_MODEL = "gemini-1.5-flash";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || DEFAULT_MODEL;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 8 },
      });
      return true;
    } catch (e) {
      const status = (e as { status?: number })?.status;
      const msg = (e as { message?: string })?.message ?? "";
      if (status === 401 || status === 403 || /PERMISSION_DENIED|API key/i.test(msg)) {
        return false;
      }
      // Non-auth error: log and re-throw.
      console.error("[GeminiProvider.validateApiKey] non-auth error:", e);
      throw e;
    }
  }

  async analyzeStyle(samples: string[]): Promise<StyleProfileCore> {
    const gm = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: buildAnalyzeSystemPrompt(),
      generationConfig: { responseMimeType: "application/json" },
    });
    return withJsonRetry<StyleProfileCore>(async () => {
      const res = await gm.generateContent({
        contents: [{ role: "user", parts: [{ text: buildAnalyzeUserPrompt(samples) }] }],
      });
      return res.response.text();
    }, "Gemini");
  }

  async generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];
  }): Promise<GenerationResult> {
    const { profile, input, imageMarkers } = args;

    // Gemini grounding via googleSearchRetrieval is generally incompatible
    // with responseMimeType: "application/json". When web search is on, we
    // drop the JSON mime type and rely on the system prompt to enforce JSON.
    const tools = input.useWebSearch
      ? ([{ googleSearchRetrieval: {} }] as unknown as Parameters<
          GoogleGenerativeAI["getGenerativeModel"]
        >[0]["tools"])
      : undefined;

    const gm = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: buildGenerateSystemPrompt(profile),
      generationConfig: input.useWebSearch
        ? {}
        : { responseMimeType: "application/json" },
      ...(tools ? { tools } : {}),
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    for (const img of input.images) {
      parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
    }
    parts.push({ text: buildGenerateUserPrompt(input, imageMarkers) });

    const raw = await withJsonRetry<{ title: string; body: string; hashtags: string[] }>(
      async () => {
        const res = await gm.generateContent({ contents: [{ role: "user", parts }] });
        return res.response.text();
      },
      "Gemini",
    );

    return {
      title: raw.title,
      body: raw.body,
      hashtags: cleanHashtags(raw.hashtags),
      imageMap: buildImageMap(input.images),
    };
  }
}
