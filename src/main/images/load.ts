import { nativeImage } from "electron";
import { extname } from "path";
import type { ImageInput } from "@shared/types";

export { MAX_IMAGES } from "@shared/constants";
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

  let img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) {
    throw new Error("이미지 파일을 읽을 수 없습니다.");
  }

  const size = img.getSize();
  if (size.width > 0 && size.height > 0 && Math.max(size.width, size.height) > MAX_LONG_EDGE) {
    const isLandscape = size.width > size.height;
    img = img.resize({
      width: isLandscape ? MAX_LONG_EDGE : undefined,
      height: !isLandscape ? MAX_LONG_EDGE : undefined,
      quality: "good"
    });
  }

  let outBuf: Buffer;
  let mediaType: "image/jpeg" | "image/png";
  if (isPng) {
    outBuf = img.toPNG();
    mediaType = "image/png";
  } else {
    outBuf = img.toJPEG(85);
    mediaType = "image/jpeg";
  }

  return {
    filename,
    mediaType,
    base64: outBuf.toString("base64"),
  };
}
