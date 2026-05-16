import { describe, it, expect } from "vitest";
import { extractFormatting, observe } from "@main/llm/formatting";

const HTML_SAMPLE_1 = `
<p class="se-text-paragraph se-text-paragraph-align-center">
  <span class="se-fs-fs34 se-ff-nanummaruburi" style="color:#222222;">큰 제목</span>
</p>
<p class="se-text-paragraph se-text-paragraph-align-left">
  <span class="se-fs-fs17 se-ff-nanummaruburi" style="color:#555555;">본문 첫줄.</span>
</p>
<p class="se-text-paragraph se-text-paragraph-align-left">
  <span class="se-fs-fs17 se-ff-nanummaruburi" style="color:#555555;">본문 두번째 줄.</span>
</p>
<p class="se-text-paragraph se-text-paragraph-align-left">
  <span class="se-fs-fs17 se-ff-nanummaruburi" style="color:#ff0000;">강조 한 줄.</span>
</p>`;

describe("observe", () => {
  it("captures font/size/align/color", () => {
    const obs = observe(HTML_SAMPLE_1);
    expect(obs.length).toBeGreaterThan(0);
    const sizes = obs.map((o) => o.fontSize).filter(Boolean);
    expect(sizes).toContain(34);
    expect(sizes).toContain(17);
    const aligns = new Set(obs.map((o) => o.align));
    expect(aligns.has("center")).toBe(true);
    expect(aligns.has("left")).toBe(true);
  });
});

describe("extractFormatting", () => {
  it("picks the most common body/heading size, primary color", () => {
    const f = extractFormatting([HTML_SAMPLE_1]);
    expect(f.bodyFontSize).toBe(17);
    expect(f.headingFontSize).toBe(34);
    expect(f.paragraphAlign).toBe("left");
    expect(f.primaryColor).toBe("#555555");
    expect(f.emphasisColor).toBe("#ff0000");
    expect(f.fontFamily).toBe("나눔 마루부리");
  });

  it("returns nulls for empty input", () => {
    const f = extractFormatting([]);
    expect(f.bodyFontSize).toBeNull();
    expect(f.fontFamily).toBeNull();
    expect(f.primaryColor).toBeNull();
  });

  it("ignores html without paragraphs", () => {
    const f = extractFormatting(["<div>no paragraphs</div>"]);
    expect(f.bodyFontSize).toBeNull();
  });
});
