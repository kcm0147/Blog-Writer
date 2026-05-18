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
  const hasHighlight = Boolean(profile.formatting?.highlightColor);
  const hasEmphasisColor = Boolean(profile.formatting?.emphasisColor);

  let formattingRules = `7) 강조할 단어(매장명, 메뉴명, 핵심 키워드 등)는 **단어** 형태의 마크다운 bold로 감쌀 것. 단, 남발하지 말고 문단당 1~2개 이내로 절제할 것.`;

  if (hasHighlight) {
    formattingRules += `\n8) 특히 중요한 구문(매장명이 처음 등장할 때, 핵심 추천 메뉴, 인상 깊은 문장 등)은 ==구문== 형태로 하이라이트 마커를 사용할 것. 문단당 0~1개만 극히 절제해서 사용.`;
  }
  if (hasEmphasisColor) {
    formattingRules += `\n${hasHighlight ? "9" : "8"}) 부제목이나 구분 문구는 ^^구문^^ 형태로 강조색 마커를 사용할 것. 글 전체에서 3~5개 이내.`;
  }

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
5) [매우 중요] 기계처럼 보이지 않게 할 것. 광고 대행사나 AI가 쓴 것 같은 정형화된 블로그 템플릿("안녕하세요 여러분~", "오늘 소개할 곳은~", "그럼 이만~", "~어떠셨나요?")을 단 하나라도 사용하면 안 됨.
6) [매우 중요] '그리고', '그래서', '하지만', '또한' 같은 접속사 남발을 절대 금지함. 문장은 접속사 없이 흐름으로 자연스럽게 이어지게 쓸 것.
7) [매우 중요] 문서를 1. 2. 3. 이나 특징: 처럼 리스트 요약 형태로 점을 찍어 나열하지 말 것. 모든 정보는 본문 안에 자연스런 서술형으로 녹여낼 것.
8) 글자수는 목표치 ±20% 이내. 글자수는 '공백을 제외한 순수 글자수'로 계산할 것. (마커, 공백, 줄바꿈은 글자수에 포함하지 않음.)
9) hashtags는 5~10개, 각 항목은 '#' 없이 키워드만.
10) 절대 과도한 줄바꿈을 하지 말 것. 스마트폰 가독성을 핑계로 한 단어나 구절마다 엔터를 치는 것은 금지. 작성하는 모든 문장은 마침표나 종결 어미가 나올 때까지 하나로 이어 쓸 것. 줄바꿈은 온전한 한 문단이 끝난 후에만 사용할 것.
${formattingRules}`;
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
  lines.push(`- 목표 글자수: ${info.length}자 (공백 제외 기준, ±20%)`);

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
    lines.push("[방문 시 실제 느낀 점/메모]");
    lines.push(memo);
    lines.push("=> 위 메모 내용들을 곧이곧대로 한 곳에 묶어 쓰지 말고, 글 중간중간에 내 진짜 속마음이나 사담을 건네듯 아주 자연스럽게 녹여내세요.");
  }
  if (imageMarkers.length) {
    const markers = imageMarkers.map((m) => `[${m}]`).join(", ");
    lines.push("");
    lines.push(`[첨부 사진 마커]\n사용 가능한 마커: ${markers}\n첨부된 이미지들을 보고, 본문 흐름상 자연스러운 위치에 마커를 삽입하세요.`);
  }
  return lines.join("\n");
}
