/**
 * Smart Editor HTML에서 스타일 패턴 추출.
 *
 * 클래스명 패턴:
 * - se-fs-fs{N} → font-size: Npx
 * - se-ff-{name} → font-family
 * - se-text-paragraph-align-{left|center|right}
 * - inline style="color:#xxx" → 색상
 */

import type { StyleFormatting } from "@shared/types";

const FONT_NAME_MAP: Record<string, string> = {
  nanummaruburi: "나눔 마루부리",
  nanumgothic: "나눔 고딕",
  nanummyeongjo: "나눔 명조",
  nanumbarungothic: "나눔 바른 고딕",
  nanumsquare: "나눔 스퀘어",
  notosanskr: "Noto Sans KR",
  spoqahansansneo: "Spoqa Han Sans Neo",
};

interface RawObservation {
  fontFamily?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  color?: string;
  bgColor?: string;
  isBold?: boolean;
  isHeading?: boolean;
}

export function observe(html: string): RawObservation[] {
  const observations: RawObservation[] = [];
  const paragraphs = html.matchAll(
    /<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g,
  );
  for (const pm of paragraphs) {
    const pTag = pm[0];
    const inner = pm[1] ?? "";
    const alignM = pTag.match(/se-text-paragraph-align-(left|center|right)/);
    const align = (alignM && alignM[1] ? alignM[1] : "left") as
      | "left"
      | "center"
      | "right";

    let foundSpan = false;
    const spans = inner.matchAll(/<span\b([^>]*)>/g);
    for (const sm of spans) {
      foundSpan = true;
      const attrs = sm[1] ?? "";
      const styleM = attrs.match(/style="([^"]*)"/);
      const classM = attrs.match(/class="([^"]*)"/);
      const style = styleM && styleM[1] ? styleM[1] : "";
      const classes = classM && classM[1] ? classM[1] : "";

      const fsM = classes.match(/se-fs-fs(\d+)/);
      const fontSize = fsM && fsM[1] ? Number(fsM[1]) : undefined;
      const ffM = classes.match(/se-ff-([A-Za-z0-9]+)/);
      const fontFamily = ffM && ffM[1]
        ? FONT_NAME_MAP[ffM[1].toLowerCase()] ?? ffM[1]
        : undefined;
      const colorM = style.match(/color\s*:\s*(#[0-9a-fA-F]{3,8})/);
      const color = colorM && colorM[1] ? colorM[1].toLowerCase() : undefined;

      // 배경색 (하이라이트) 추출
      const bgM = style.match(/background-color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb[^)]*\))/i);
      const bgClassM = classes.match(/se-bg-([A-Fa-f0-9]{6})/);
      const bgColor = bgM?.[1]?.toLowerCase()
        ?? (bgClassM?.[1] ? `#${bgClassM[1].toLowerCase()}` : undefined);

      // Bold 감지 (<b>, <strong> 또는 font-weight:bold)
      const isBold = /font-weight\s*:\s*(bold|[7-9]00)/i.test(style)
        || /<(?:b|strong)\b/i.test(inner);

      if (fontSize !== undefined || fontFamily || color || bgColor) {
        observations.push({
          fontFamily,
          fontSize,
          align,
          color,
          bgColor,
          isBold,
          isHeading: fontSize !== undefined && fontSize >= 24,
        });
      }
    }
    if (!foundSpan) {
      observations.push({ align });
    }
  }
  return observations;
}

function mostCommon<T extends string | number>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

export function extractFormatting(htmls: string[]): StyleFormatting {
  const obs = htmls.flatMap(observe);
  const bodyObs = obs.filter((o) => !o.isHeading);
  const headingObs = obs.filter((o) => o.isHeading);

  const fontFamily = mostCommon(
    obs.map((o) => o.fontFamily).filter((v): v is string => Boolean(v)),
  );
  const bodyFontSize = mostCommon(
    bodyObs
      .map((o) => o.fontSize)
      .filter((v): v is number => typeof v === "number"),
  );
  const headingFontSize = mostCommon(
    headingObs
      .map((o) => o.fontSize)
      .filter((v): v is number => typeof v === "number"),
  );
  const paragraphAlign = mostCommon(
    bodyObs
      .map((o) => o.align)
      .filter((v): v is "left" | "center" | "right" => Boolean(v)),
  );

  // Body-only colors so heading hues don't leak into primary/emphasis.
  const bodyColors = bodyObs
    .map((o) => o.color)
    .filter((v): v is string => Boolean(v));
  const colorCountMap = new Map<string, number>();
  for (const c of bodyColors) {
    colorCountMap.set(c, (colorCountMap.get(c) ?? 0) + 1);
  }
  const colorCounts = [...colorCountMap.entries()].sort((a, b) => b[1] - a[1]);
  const primaryColor = colorCounts[0]?.[0] ?? null;
  const emphasisColor = colorCounts[1]?.[0] ?? null;

  // 배경 강조색 (highlight)
  const bgColors = bodyObs
    .map((o) => o.bgColor)
    .filter((v): v is string => Boolean(v));
  const bgCountMap = new Map<string, number>();
  for (const c of bgColors) bgCountMap.set(c, (bgCountMap.get(c) ?? 0) + 1);
  const bgCounts = [...bgCountMap.entries()].sort((a, b) => b[1] - a[1]);
  const highlightColor = bgCounts[0]?.[0] ?? null;

  return {
    fontFamily,
    bodyFontSize,
    headingFontSize,
    paragraphAlign,
    primaryColor,
    emphasisColor,
    highlightColor,
  };
}
