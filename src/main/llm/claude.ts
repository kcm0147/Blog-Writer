import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./types";
import type {
  GenerateInput, GenerationResult, StyleProfile, StyleProfileCore,
} from "@shared/types";
import {
  buildAnalyzeSystemPrompt, buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt, buildGenerateUserPrompt,
} from "./prompts";
import { buildImageMap, cleanHashtags, withJsonRetry } from "./utils";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;

// web_search_20250305 is a server-side tool not yet present in
// Anthropic SDK v0.40's ToolUnion. Define a minimal local type.
type WebSearchTool = {
  type: "web_search_20250305";
  name: "web_search";
  max_uses: number;
};

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
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      // Non-auth error: log and re-throw so caller can distinguish
      // network/rate-limit problems from genuine auth failures.
      console.error("[ClaudeProvider.validateApiKey] non-auth error:", e);
      throw e;
    }
  }

  async analyzeStyle(samples: string[]): Promise<StyleProfileCore> {
    return withJsonRetry<StyleProfileCore>(async () => {
      const message = await this.client.messages.create({
        model: MODEL, max_tokens: MAX_TOKENS,
        system: buildAnalyzeSystemPrompt(),
        messages: [{ role: "user", content: buildAnalyzeUserPrompt(samples) }],
      });
      return this.extractText(message);
    }, "Claude");
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

    const webSearchTool: WebSearchTool = {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 3,
    };
    const tools = input.useWebSearch
      ? ([webSearchTool] as unknown as Anthropic.Messages.ToolUnion[])
      : undefined;

    const raw = await withJsonRetry<{ title: string; body: string; hashtags: string[] }>(
      async () => {
        const message = await this.client.messages.create({
          model: MODEL, max_tokens: MAX_TOKENS,
          system: [{
            type: "text",
            text: buildGenerateSystemPrompt(profile),
            cache_control: { type: "ephemeral" },
          }],
          messages: [{ role: "user", content }],
          ...(tools ? { tools } : {}),
        });
        return this.extractText(message);
      },
      "Claude",
    );

    return {
      title: raw.title,
      body: raw.body,
      hashtags: cleanHashtags(raw.hashtags),
      imageMap: buildImageMap(input.images),
    };
  }

  private extractText(message: Anthropic.Messages.Message): string {
    for (const b of message.content) {
      if (b.type === "text") return b.text;
    }
    throw new Error("Claude 응답에 text 블록이 없습니다.");
  }
}
