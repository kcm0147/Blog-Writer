import type { ImageInput } from "@shared/types";

const FENCE_RE = /^```(?:json)?\s*|\s*```$/gm;

export function parseLlmJson<T>(text: string, providerName: string): T {
  const cleaned = text.replace(FENCE_RE, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(
      `${providerName} JSON 파싱 실패: ${(e as Error).message}\n원문: ${text.slice(0, 300)}`,
    );
  }
}

export function buildImageMap(images: ImageInput[]): Record<string, string> {
  const out: Record<string, string> = {};
  images.forEach((img, i) => {
    out[`사진${i + 1}`] = img.filename;
  });
  return out;
}

export function cleanHashtags(input: string[]): string[] {
  return input.map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
}

export async function withJsonRetry<T>(
  fn: () => Promise<string>,
  providerName: string,
): Promise<T> {
  try {
    return parseLlmJson<T>(await fn(), providerName);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("JSON 파싱 실패")) throw e;
    // Single retry
    return parseLlmJson<T>(await fn(), providerName);
  }
}
