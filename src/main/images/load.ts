import sharp from "sharp";
import { extname } from "path";
import type { ImageInput } from "@shared/types";

export const MAX_LONG_EDGE = 1568;
const SUPPORTED = new Set([".jpg", ".jpeg", ".png"]);

export async function prepareImage(
  filename: string,
  buffer: Buffer,
): Promise<ImageInput> {
  const ext = extname(filename).toLowerCase();
  if (!SUPPORTED.has(ext)) {
    throw new Error(`지원하지 않는 확장자: ${ext}`);
  }
  const isPng = ext === ".png";

  let pipeline = sharp(buffer).rotate();
  const meta = await sharp(buffer).metadata();
  if (meta.width && meta.height && Math.max(meta.width, meta.height) > MAX_LONG_EDGE) {
    pipeline = pipeline.resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let outBuf: Buffer;
  let mediaType: "image/jpeg" | "image/png";
  if (isPng) {
    outBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    mediaType = "image/png";
  } else {
    outBuf = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    mediaType = "image/jpeg";
  }

  return {
    filename,
    mediaType,
    base64: outBuf.toString("base64"),
  };
}
