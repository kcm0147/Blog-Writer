/**
 * 히스토리 이미지 저장/로드
 * - 글 생성 시 이미지를 파일 시스템에 저장
 * - 히스토리 조회 시 이미지를 base64로 로드
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { getDataDir } from "../storage/settings";
import type { ImageInput } from "@shared/types";

function imagesDir(): string {
  return join(getDataDir(), "history-images");
}

function recordDir(recordId: string): string {
  return join(imagesDir(), recordId);
}

/** 생성 결과와 함께 이미지를 파일로 저장 */
export function saveHistoryImages(recordId: string, images: ImageInput[]): void {
  if (images.length === 0) return;
  const dir = recordDir(recordId);
  mkdirSync(dir, { recursive: true });

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img) continue;
    const ext = img.mediaType === "image/png" ? ".png" : ".jpg";
    const filename = `photo_${i + 1}${ext}`;
    writeFileSync(join(dir, filename), Buffer.from(img.base64, "base64"));
  }

  // 메타데이터 저장 (원본 파일명 매핑)
  const meta = images.map((img, i) => ({
    index: i + 1,
    filename: img.filename,
    mediaType: img.mediaType,
    stored: `photo_${i + 1}${img.mediaType === "image/png" ? ".png" : ".jpg"}`,
  }));
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
}

/** 히스토리 레코드의 이미지를 base64로 로드 */
export function loadHistoryImages(recordId: string): ImageInput[] {
  const dir = recordDir(recordId);
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) return [];

  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as Array<{
      index: number;
      filename: string;
      mediaType: "image/jpeg" | "image/png";
      stored: string;
    }>;

    return meta.map((m) => {
      const filePath = join(dir, m.stored);
      if (!existsSync(filePath)) {
        return { filename: m.filename, mediaType: m.mediaType, base64: "" };
      }
      const base64 = readFileSync(filePath).toString("base64");
      return { filename: m.filename, mediaType: m.mediaType, base64 };
    }).filter((img) => img.base64.length > 0);
  } catch {
    return [];
  }
}

/** 히스토리 삭제 시 이미지도 함께 삭제 */
export function deleteHistoryImages(recordId: string): void {
  const dir = recordDir(recordId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}
