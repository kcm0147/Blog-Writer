import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { prepareImage, MAX_LONG_EDGE } from "@main/images/load";

async function makeJpegBuffer(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
}

describe("prepareImage", () => {
  it("returns jpeg media type for jpeg input", async () => {
    const buf = await makeJpegBuffer(400, 300);
    const out = await prepareImage("test.jpg", buf);
    expect(out.mediaType).toBe("image/jpeg");
    expect(out.filename).toBe("test.jpg");
    expect(out.base64.length).toBeGreaterThan(0);
  });

  it("resizes images longer than MAX_LONG_EDGE", async () => {
    const buf = await makeJpegBuffer(4000, 3000);
    const out = await prepareImage("big.jpg", buf);
    const decoded = Buffer.from(out.base64, "base64");
    const meta = await sharp(decoded).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(MAX_LONG_EDGE);
  });

  it("rejects unsupported extensions", async () => {
    const buf = Buffer.from("not an image");
    await expect(prepareImage("test.gif", buf)).rejects.toThrow();
  });
});
