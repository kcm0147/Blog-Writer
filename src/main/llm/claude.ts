import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./types";
import type {
  GenerateInput, GenerationResult, StyleProfile, StyleProfileCore,
} from "@shared/types";
import {
  buildAnalyzeSystemPrompt, buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt, buildGenerateUserPrompt,
} from "./prompts";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;
const FENCE_RE = /^```(?:json)?\s*|\s*```$/gm;

function parseJson<T>(text: string): T {
  const cleaned = text.replace(FENCE_RE, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Claude JSON 파싱 실패: ${(e as Error).message}\n원문: ${text.slice(0, 300)}`);
  }
}

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude" as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: MODEL, max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      });
      return true;
    } catch {
      return false;
    }
  }

  async analyzeStyle(samples: string[]): Promise<StyleProfileCore> {
    const message = await this.client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS,
      system: buildAnalyzeSystemPrompt(),
      messages: [{ role: "user", content: buildAnalyzeUserPrompt(samples) }],
    });
    const text = this.extractText(message);
    return parseJson<StyleProfileCore>(text);
  }

  async generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];
  }): Promise<GenerationResult> {
    const { profile, input, imageMarkers } = args;
    const content: Anthropic.Messages.ContentBlockParam[] = [];
    for (const img of input.images) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      });
    }
    content.push({ type: "text", text: buildGenerateUserPrompt(input, imageMarkers) });

    const message = await this.client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS,
      system: [{
        type: "text",
        text: buildGenerateSystemPrompt(profile),
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content }],
    });

    const text = this.extractText(message);
    const raw = parseJson<{ title: string; body: string; hashtags: string[] }>(text);

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

  private extractText(message: Anthropic.Messages.Message): string {
    for (const b of message.content) {
      if (b.type === "text") return b.text;
    }
    throw new Error("Claude 응답에 text 블록이 없습니다.");
  }
}
