import type { Database } from "better-sqlite3";
import type { LLMProvider } from "@main/llm/types";
import { getAllBodies } from "@main/storage/samples";
import { saveProfile } from "@main/storage/styleProfile";
import type { StyleProfile } from "@shared/types";

export const MIN_SAMPLES_WARN = 5;

export async function runAnalyze(
  db: Database,
  provider: LLMProvider,
  opts: { onWarning?: (msg: string) => void; onProgress?: (stage: string) => void } = {},
): Promise<StyleProfile> {
  const bodies = getAllBodies(db);
  if (bodies.length === 0) {
    throw new Error("등록된 스타일 샘플이 없습니다. 먼저 글을 추가해주세요.");
  }
  if (bodies.length < MIN_SAMPLES_WARN) {
    opts.onWarning?.(
      `샘플이 ${bodies.length}개로 5개 미만입니다. 스타일 분석 정확도가 떨어질 수 있습니다.`,
    );
  }
  opts.onProgress?.("분석 중");
  const core = await provider.analyzeStyle(bodies);
  return saveProfile(db, core);
}
