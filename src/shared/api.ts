import type {
  GenerateInput, HistoryRecord, ImageInput, Provider, Sample,
  SettingsWithKeyStatus, StyleProfile,
} from "./types";
import type { GenerateOutcome } from "./generate-outcome";

export type { GenerateOutcome };

export interface AppApi {
  settings: {
    get(): Promise<SettingsWithKeyStatus>;
    setProvider(p: Provider): Promise<void>;
    setWebSearch(on: boolean): Promise<void>;
    setApiKey(p: Provider, key: string): Promise<void>;
    clearApiKey(p: Provider): Promise<void>;
    validateApiKey(p: Provider): Promise<boolean>;
  };
  samples: {
    list(): Promise<Sample[]>;
    add(input: { label: string; body: string }): Promise<Sample>;
    delete(id: string): Promise<void>;
  };
  style: {
    getProfile(): Promise<StyleProfile | null>;
    analyze(): Promise<StyleProfile>;
    onProgress(cb: (stage: string) => void): () => void;
    onWarning(cb: (msg: string) => void): () => void;
  };
  images: {
    prepare(filename: string, data: Uint8Array): Promise<ImageInput>;
  };
  generate: {
    run(input: GenerateInput): Promise<GenerateOutcome>;
    onProgress(cb: (stage: string) => void): () => void;
  };
  history: {
    list(): Promise<HistoryRecord[]>;
    get(id: string): Promise<HistoryRecord | null>;
    delete(id: string): Promise<void>;
  };
}

declare global {
  interface Window { api: AppApi }
}
