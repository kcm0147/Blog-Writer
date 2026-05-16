export type Provider = "claude" | "gemini";

export type PostType = "맛집" | "카페" | "여행" | "기타";
export type Tone = "my_style" | "해요" | "합니다" | "반말";

export interface Sample {
  id: string;
  label: string;
  body: string;
  charCount: number;
  createdAt: string;
}

export interface StyleFormatting {
  fontFamily: string | null;
  bodyFontSize: number | null;
  headingFontSize: number | null;
  paragraphAlign: "left" | "center" | "right" | null;
  primaryColor: string | null;
  emphasisColor: string | null;
}

export interface StyleProfile {
  toneDistribution: Record<string, number>;
  avgSentenceLength: number;
  commonExpressions: string[];
  emojiFrequency: "none" | "low" | "medium" | "high";
  structureNotes: string;
  photoDescriptionStyle: string;
  formatting?: StyleFormatting;
  sourceHash: string;
  sampleCount: number;
  updatedAt: string;
}

export type StyleProfileCore = Omit<
  StyleProfile,
  "sourceHash" | "sampleCount" | "updatedAt"
>;

export interface StoreInfo {
  storeName: string;
  address: string;
  visitDate?: string;
  postType: PostType;
  title?: string;
  keywords: string[];
  length: number;
  tone: Tone;
  emphasis: string;
}

export interface ImageInput {
  filename: string;
  mediaType: "image/jpeg" | "image/png";
  base64: string;
}

export interface GenerateInput {
  info: StoreInfo;
  memo: string;
  images: ImageInput[];
  useWebSearch: boolean;
}

export interface GenerationResult {
  title: string;
  body: string;
  hashtags: string[];
  imageMap: Record<string, string>;
}

export interface HistoryRecord extends GenerationResult {
  id: string;
  storeName: string;
  address?: string;
  postType: PostType;
  createdAt: string;
}

export interface Settings {
  provider: Provider;
  useWebSearch: boolean;
}

export interface SettingsWithKeyStatus extends Settings {
  hasApiKey: Record<Provider, boolean>;
  apiKeyMasked: Record<Provider, string | null>;
  models: Record<Provider, string>;
}

export interface DraftPayload {
  storeName: string;
  address: string;
  visitDate: string;
  postType: string;
  postTypeExtra: string;
  title: string;
  keywords: string[];
  length: number;
  tone: string;
  emphasis: string;
  memo: string;
  images: ImageInput[];
}

export interface DraftSummary {
  id: string;
  label: string;
  storeName: string | null;
  postType: string | null;
  updatedAt: string;
}

export interface Draft extends DraftSummary {
  payload: DraftPayload;
}
