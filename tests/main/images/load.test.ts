import { beforeEach, describe, expect, it, vi } from "vitest";

type MockImageInput = {
  width: number;
  height: number;
  empty?: boolean;
};

type ResizeOptions = {
  width?: number;
  height?: number;
  quality?: "best" | "good" | "better";
};

function encodeMockImage(input: MockImageInput): Buffer {
  return Buffer.from(JSON.stringify(input));
}

const createFromBuffer = vi.fn((buffer: Buffer) => {
  const input = JSON.parse(buffer.toString()) as MockImageInput;
  const image = {
    isEmpty: vi.fn(() => input.empty === true),
    getSize: vi.fn(() => ({ width: input.width, height: input.height })),
    resize: vi.fn((options: ResizeOptions) => {
      const nextWidth = options.width ?? Math.round(input.width * (options.height! / input.height));
      const nextHeight = options.height ?? Math.round(input.height * (options.width! / input.width));
      return createFromBuffer(encodeMockImage({ width: nextWidth, height: nextHeight }));
    }),
    toPNG: vi.fn(() => Buffer.from("png")),
    toJPEG: vi.fn(() => Buffer.from("jpeg")),
  };
  return image;
});

vi.mock("electron", () => ({
  nativeImage: {
    createFromBuffer,
  },
}));

describe("prepareImage", () => {
  beforeEach(() => {
    createFromBuffer.mockClear();
  });

  it("returns jpeg media type for jpeg input", async () => {
    const { prepareImage } = await import("@main/images/load");
    const buf = encodeMockImage({ width: 400, height: 300 });
    const out = await prepareImage("test.jpg", buf);
    expect(out.mediaType).toBe("image/jpeg");
    expect(out.filename).toBe("test.jpg");
    expect(out.base64.length).toBeGreaterThan(0);
  });

  it("resizes images longer than MAX_LONG_EDGE", async () => {
    const { MAX_LONG_EDGE, prepareImage } = await import("@main/images/load");
    const buf = encodeMockImage({ width: 4000, height: 3000 });
    const out = await prepareImage("big.jpg", buf);
    const image = createFromBuffer.mock.results[0]?.value;
    expect(image.resize).toHaveBeenCalledWith({ width: MAX_LONG_EDGE, height: undefined, quality: "good" });
    expect(out.mediaType).toBe("image/jpeg");
  });

  it("rejects unsupported extensions", async () => {
    const { prepareImage } = await import("@main/images/load");
    const buf = Buffer.from("not an image");
    await expect(prepareImage("test.gif", buf)).rejects.toThrow();
  });
});
