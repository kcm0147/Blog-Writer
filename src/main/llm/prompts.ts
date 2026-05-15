import type { GenerateInput, StyleProfile } from "@shared/types";

export function buildAnalyzeSystemPrompt(): string {
  return `당신은 한국어 블로그 글의 문체와 구성을 분석하는 전문가입니다.
사용자가 직접 작성한 여러 편의 블로그 글을 보고, 그 사람의 고유한 글쓰기 스타일을 추출하여 아래 JSON으로만 응답하세요. 다른 텍스트 금지.

{
  "toneDistribution": {"해요": float, "합니다": float, "반말": float},
  "avgSentenceLength": int,
  "commonExpressions": [string, ...],
  "emojiFrequency": "none" | "low" | "medium" | "high",
  "structureNotes": string,
  "photoDescriptionStyle": string
}`;
}

export function buildAnalyzeUserPrompt(samples: string[]): string {
  const parts = ["아래는 사용자가 직접 쓴 블로그 글들입니다. 분석해주세요.\n"];
  samples.forEach((s, i) => parts.push(`---\n[글 ${i + 1}]\n${s}\n`));
  return parts.join("\n");
}

export function buildGenerateSystemPrompt(profile: StyleProfile): string {
  return `당신은 사용자의 블로그 글쓰기 스타일을 모방하여 네이버 블로그용 방문 후기 글을 작성하는 작가입니다.
아래는 사용자의 스타일 프로파일입니다. 반드시 이 스타일을 반영하세요.

\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

출력 규칙:
1) 응답은 반드시 아래 JSON 한 덩어리만 출력. 다른 텍스트 금지.
   {"title": string, "body": string, "hashtags": [string, ...]}
2) body 안에 [사진N] 마커를 본문 흐름상 자연스러운 위치에 삽입.
3) 모든 사진을 본문에 한 번씩 등장시키고, 같은 사진을 두 번 인용 금지.
4) 글자수는 목표치 ±20% 이내. (마커는 글자수에 포함하지 않음.)
5) 광고처럼 보이지 않게, 사용자의 평소 말투/구조/표현을 그대로 사용.
6) hashtags는 5~10개, 각 항목은 '#' 없이 키워드만.`;
}

export function buildGenerateUserPrompt(
  input: GenerateInput,
  imageMarkers: string[],
): string {
  const { info, memo } = input;
  const lines: string[] = [
    "다음 정보로 네이버 블로그용 방문 후기 글을 작성해주세요.",
    "",
    `- 매장명: ${info.storeName}`,
    `- 주소: ${info.address}`,
  ];
  if (info.visitDate) lines.push(`- 방문일: ${info.visitDate}`);
  lines.push(`- 글 타입: ${info.postType}`);
  lines.push(`- 목표 글자수: ${info.length}자 (±20%)`);

  if (info.tone === "my_style") {
    lines.push("- 말투: 사용자의 스타일 프로파일을 그대로 따를 것.");
  } else {
    lines.push(`- 말투: 반드시 '${info.tone}' 어미를 사용할 것.`);
  }
  if (info.title) lines.push(`- 제목(고정): ${info.title}`);
  else lines.push("- 제목: 적절한 제목을 직접 지어줄 것.");

  if (info.keywords.length) {
    lines.push(`- SEO 키워드 (본문에 자연스럽게 포함): ${info.keywords.join(", ")}`);
  }
  if (info.emphasis) {
    lines.push("- 강조/제외 사항:");
    lines.push(info.emphasis);
  }
  if (memo) {
    lines.push("");
    lines.push("[방문 메모]");
    lines.push(memo);
  }
  if (imageMarkers.length) {
    const markers = imageMarkers.map((m) => `[${m}]`).join(", ");
    lines.push("");
    lines.push(`[첨부 사진 마커]\n사용 가능한 마커: ${markers}\n첨부된 이미지들을 보고, 본문 흐름상 자연스러운 위치에 마커를 삽입하세요.`);
  }
  return lines.join("\n");
}
