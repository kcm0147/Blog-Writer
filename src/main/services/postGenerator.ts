import type { Database } from "better-sqlite3";
import type { LLMProvider } from "@main/llm/types";
import { loadProfile, loadProfileIfFresh } from "@main/storage/styleProfile";
import { saveGeneration } from "@main/storage/history";
import type { GenerateInput, GenerationResult } from "@shared/types";
import type { GenerateOutcome } from "@shared/generate-outcome";

export type { GenerateOutcome };

const LENGTH_TOLERANCE = 0.2;

export async function runGenerate(
  db: Database,
  provider: LLMProvider,
  input: GenerateInput,
  opts: { onProgress?: (stage: string) => void } = {},
): Promise<GenerateOutcome> {
  console.log(
    `[generate] 시작 — 매장 "${input.info.storeName}", 사진 ${input.images.length}장`,
  );
  const profile = loadProfileIfFresh(db);
  if (!profile) {
    if (loadProfile(db)) {
      throw new Error("샘플이 변경되었습니다. 내 스타일에서 다시 분석해주세요.");
    }
    throw new Error("스타일 프로파일이 없습니다. 먼저 분석을 실행해주세요.");
  }

  const imageMarkers = input.images.map((_, i) => `사진${i + 1}`);
  opts.onProgress?.("step:provider_call");
  console.log(
    `[generate] LLM 호출 중 (${provider.name}, webSearch=${input.useWebSearch})...`,
  );
  const t0 = Date.now();
  const result = await provider.generatePost({ profile, input, imageMarkers });
  console.log(
    `[generate] LLM 응답 — ${Date.now() - t0}ms, body ${result.body.length}자`,
  );

  opts.onProgress?.("step:validating");
  const warnings = validate(result, imageMarkers, input.info.length);
  if (warnings.length) console.warn(`[generate] 검증 경고:`, warnings);

  opts.onProgress?.("step:saving");
  const record = saveGeneration(db, {
    storeName: input.info.storeName,
    address: input.info.address || null,
    postType: input.info.postType,
    title: result.title,
    body: result.body,
    hashtags: result.hashtags,
    imageMap: result.imageMap,
  });
  console.log(`[generate] 저장 완료 — id=${record.id}`);
  opts.onProgress?.("step:done");

  return { result, record, warnings };
}

function validate(
  result: GenerationResult,
  expectedMarkers: string[],
  targetLength: number,
): string[] {
  const warnings: string[] = [];
  const found = new Set(result.body.match(/\[사진\d+\]/g) ?? []);
  const expected = new Set(expectedMarkers.map((m) => `[${m}]`));
  const missing = [...expected].filter((m) => !found.has(m));
  const extra = [...found].filter((m) => !expected.has(m));
  if (missing.length) warnings.push(`본문에 빠진 사진 마커: ${missing.join(", ")}`);
  if (extra.length) warnings.push(`존재하지 않는 사진을 가리키는 마커: ${extra.join(", ")}`);

  const bodyNoMarkers = result.body.replace(/\[사진\d+\]/g, "");
  const actual = bodyNoMarkers.length;
  const low = Math.floor(targetLength * (1 - LENGTH_TOLERANCE));
  const high = Math.ceil(targetLength * (1 + LENGTH_TOLERANCE));
  if (actual < low || actual > high) {
    warnings.push(`글자수 ${actual}자 — 목표 ${targetLength}자 (허용 ${low}~${high}) 벗어남.`);
  }

  return warnings;
}
