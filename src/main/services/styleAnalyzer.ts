import type { Database } from "better-sqlite3";
import type { LLMProvider } from "@main/llm/types";
import { getAllBodies, listSampleHtmls } from "@main/storage/samples";
import { saveProfile } from "@main/storage/styleProfile";
import { extractFormatting } from "@main/llm/formatting";
import type { StyleProfile } from "@shared/types";

export const MIN_SAMPLES_WARN = 5;

export async function runAnalyze(
  db: Database,
  provider: LLMProvider,
  opts: { onWarning?: (msg: string) => void; onProgress?: (stage: string) => void } = {},
): Promise<StyleProfile> {
  const bodies = getAllBodies(db);
  console.log(`[analyze] 시작 — 샘플 ${bodies.length}편`);
  if (bodies.length === 0) {
    throw new Error("등록된 스타일 샘플이 없습니다. 먼저 글을 추가해주세요.");
  }
  if (bodies.length < MIN_SAMPLES_WARN) {
    opts.onWarning?.(
      `샘플이 ${bodies.length}개로 5개 미만입니다. 스타일 분석 정확도가 떨어질 수 있습니다.`,
    );
  }

  opts.onProgress?.("step:samples_loaded");
  console.log(`[analyze] LLM 호출 중 (${provider.name})...`);
  const t0 = Date.now();
  const core = await provider.analyzeStyle(bodies);
  console.log(`[analyze] LLM 응답 수신 — ${Date.now() - t0}ms`);

  opts.onProgress?.("step:llm_done");
  const htmls = listSampleHtmls(db);
  console.log(`[analyze] 서식 추출 — HTML 샘플 ${htmls.length}편`);
  const formatting = htmls.length > 0 ? extractFormatting(htmls) : undefined;
  if (formatting) {
    console.log(`[analyze] 추출된 서식:`, formatting);
  }

  opts.onProgress?.("step:formatting_done");
  const profile = saveProfile(db, { ...core, formatting });
  console.log(`[analyze] 저장 완료 — sampleCount=${profile.sampleCount}`);
  opts.onProgress?.("step:saved");
  return profile;
}
