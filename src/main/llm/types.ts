import type {
  GenerateInput, GenerationResult, Provider, StyleProfile, StyleProfileCore,
} from "@shared/types";

export interface LLMProvider {
  readonly name: Provider;
  validateApiKey(): Promise<boolean>;
  analyzeStyle(samples: string[]): Promise<StyleProfileCore>;
  generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];
  }): Promise<GenerationResult>;
}
