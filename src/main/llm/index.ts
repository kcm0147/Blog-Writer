import type { Provider } from "@shared/types";
import type { LLMProvider } from "./types";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";

export function makeProvider(name: Provider, apiKey: string, model?: string): LLMProvider {
  switch (name) {
    case "claude": return new ClaudeProvider(apiKey, model);
    case "gemini": return new GeminiProvider(apiKey, model);
  }
}

export type { LLMProvider } from "./types";
