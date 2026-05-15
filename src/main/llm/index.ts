import type { Provider } from "@shared/types";
import type { LLMProvider } from "./types";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";

export function makeProvider(name: Provider, apiKey: string): LLMProvider {
  switch (name) {
    case "claude": return new ClaudeProvider(apiKey);
    case "gemini": return new GeminiProvider(apiKey);
  }
}

export type { LLMProvider } from "./types";
