import type { ImageInput } from "@shared/types";

export async function fileToImageInput(file: File): Promise<ImageInput> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binary);
  const mediaType: ImageInput["mediaType"] = file.type === "image/png" ? "image/png" : "image/jpeg";
  return { filename: file.name, mediaType, base64 };
}
