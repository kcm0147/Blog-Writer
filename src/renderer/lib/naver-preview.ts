/**
 * 공통 유틸: 네이버 블로그 스타일 미리보기 HTML 빌드
 * - Compose.tsx / History.tsx / MyStyle.tsx 등 여러 곳에서 공유
 *
 * 지원하는 인라인 서식 마커:
 *   **텍스트**   → bold (<strong>)
 *   ==텍스트==   → 배경 하이라이트 (highlightColor)
 *   ^^텍스트^^   → 강조색 텍스트 (emphasisColor)
 */
import type { ImageInput, StyleFormatting, StyleProfile } from "@shared/types";

export function baseStyleFromFormatting(f: StyleFormatting | undefined): string {
  if (!f) return "";
  const parts: string[] = [];
  if (f.fontFamily) parts.push(`font-family: '${f.fontFamily}', sans-serif`);
  if (f.bodyFontSize) parts.push(`font-size: ${f.bodyFontSize}px`);
  if (f.primaryColor) parts.push(`color: ${f.primaryColor}`);
  parts.push("line-height: 1.6");
  return parts.join(";");
}

/**
 * body 텍스트를 네이버 스타일 HTML로 변환합니다.
 * - **텍스트** → <strong> (bold)
 * - ==텍스트== → <mark> 배경 하이라이트
 * - ^^텍스트^^ → <span> 강조색
 * - [사진N] → 인라인 이미지 (images 배열 제공 시)
 */
export function buildStyledHtml(
  body: string,
  profile: StyleProfile | null,
  images: ImageInput[] = [],
): string {
  const formatting = profile?.formatting;
  const align = formatting?.paragraphAlign ?? "left";
  const color = formatting?.primaryColor ?? "";
  const fontFamily = formatting?.fontFamily ?? "";
  const bodyFontSize = formatting?.bodyFontSize
    ? `${formatting.bodyFontSize}px`
    : "";
  const highlightColor = formatting?.highlightColor ?? "#fef0cc";
  const emphasisColor = formatting?.emphasisColor ?? "";

  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      const styles = [
        `text-align:${align}`,
        color ? `color:${color}` : "",
        fontFamily ? `font-family:${fontFamily}` : "",
        bodyFontSize ? `font-size:${bodyFontSize}` : "",
      ]
        .filter(Boolean)
        .join(";");

      // 1) HTML 이스케이프
      let safe = p
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

      // 2) ==하이라이트== → <mark> (배경색 강조)
      safe = safe.replace(
        /==(.+?)==/g,
        `<mark style="background-color:${highlightColor};padding:2px 4px;border-radius:3px;font-weight:700;">$1</mark>`,
      );

      // 3) ^^강조색^^ → <span> (강조 텍스트 색상)
      if (emphasisColor) {
        safe = safe.replace(
          /\^\^(.+?)\^\^/g,
          `<span style="color:${emphasisColor};font-weight:700;">$1</span>`,
        );
      }

      // 4) **bold** → <strong>
      safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

      // 5) [사진N] 마커 → 이미지 대체
      const withInlineImages = safe.replace(
        /\[사진(\d+)\]/g,
        (match, n: string) => {
          const idx = Number(n) - 1;
          const img = images[idx];
          if (!img) return match;
          return (
            `<span style="display:block;margin:8px 0;">` +
            `<span style="display:inline-block;font-size:11px;font-weight:700;` +
            `background:#fff;color:#ff5b2e;border:1px solid #ffd9c9;` +
            `padding:2px 8px;border-radius:999px;margin-bottom:4px;">${match}</span><br>` +
            `<img src="data:${img.mediaType};base64,${img.base64}" ` +
            `alt="${match}" ` +
            `style="max-width:280px;max-height:280px;display:block;` +
            `border-radius:8px;border:1px solid #eee;" />` +
            `</span>`
          );
        },
      );

      return `<p style="${styles}">${withInlineImages}</p>`;
    })
    .join("");
}

/**
 * 서식이 적용된 HTML을 클립보드에 복사합니다.
 * 네이버 스마트에디터 ONE에 Ctrl+V 하면 색상/볼드/하이라이트가 그대로 유지됩니다.
 * 이미지 마커 [사진N]은 텍스트로 남겨둡니다 (base64 이미지는 클립보드에 넣으면 너무 무거우므로).
 */
export async function copyStyledHtml(
  body: string,
  profile: StyleProfile | null,
): Promise<void> {
  const formatting = profile?.formatting;
  const align = formatting?.paragraphAlign ?? "left";
  const color = formatting?.primaryColor ?? "";
  const fontFamily = formatting?.fontFamily ?? "";
  const bodyFontSize = formatting?.bodyFontSize
    ? `${formatting.bodyFontSize}px`
    : "";
  const highlightColor = formatting?.highlightColor ?? "#fef0cc";
  const emphasisColor = formatting?.emphasisColor ?? "";

  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const html = paragraphs
    .map((p) => {
      const styles = [
        `text-align:${align}`,
        color ? `color:${color}` : "",
        fontFamily ? `font-family:${fontFamily}` : "",
        bodyFontSize ? `font-size:${bodyFontSize}` : "",
        "line-height:1.8",
      ]
        .filter(Boolean)
        .join(";");

      // HTML escape
      let safe = p
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

      // ==하이라이트==
      safe = safe.replace(
        /==(.+?)==/g,
        `<mark style="background-color:${highlightColor};padding:2px 4px;border-radius:3px;font-weight:700;">$1</mark>`,
      );

      // ^^강조색^^
      if (emphasisColor) {
        safe = safe.replace(
          /\^\^(.+?)\^\^/g,
          `<span style="color:${emphasisColor};font-weight:700;">$1</span>`,
        );
      }

      // **bold**
      safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

      return `<p style="${styles}">${safe}</p>`;
    })
    .join("");

  // text/html + text/plain 동시 기록
  const htmlBlob = new Blob([html], { type: "text/html" });
  const textBlob = new Blob([body], { type: "text/plain" });
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    }),
  ]);
}
