import type { GenerationResult, HistoryRecord } from "./types";

export interface GenerateOutcome {
  result: GenerationResult;
  record: HistoryRecord;
  warnings: string[];
}
