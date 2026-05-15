/**
 * SDK / 내부 에러를 사용자가 이해할 수 있는 한국어 메시지로 변환.
 * 상세는 console.error로만 출력하고, 던지는 메시지는 깔끔하게.
 */
export function toUserMessage(err: unknown): string {
  if (!(err instanceof Error)) return "알 수 없는 오류가 발생했습니다.";
  const msg = err.message;
  const status = (err as { status?: number }).status;

  // 인증/권한
  if (status === 401 || status === 403) {
    return "API 키가 유효하지 않거나 권한이 없습니다. 설정에서 키를 확인해주세요.";
  }
  if (/PERMISSION_DENIED|invalid[\s_-]?api[\s_-]?key|authentication/i.test(msg)) {
    return "API 키가 유효하지 않거나 권한이 없습니다. 설정에서 키를 확인해주세요.";
  }

  // 레이트 리밋
  if (status === 429 || /rate[\s_-]?limit/i.test(msg)) {
    return "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
  }

  // 네트워크
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch failed/i.test(msg)) {
    return "네트워크 연결에 문제가 있습니다. 인터넷을 확인하고 다시 시도해주세요.";
  }

  // 모델 파싱 실패
  if (msg.includes("JSON 파싱 실패")) {
    return "AI 응답을 해석하지 못했습니다. 다시 시도해주세요.";
  }

  // 토큰 / 컨텍스트
  if (/context[\s_-]?length|too[\s_-]?many[\s_-]?tokens|payload too large/i.test(msg)) {
    return "입력이 너무 길어요. 사진 수나 메모 길이를 줄여보세요.";
  }

  // Fallback: 첫 줄만 노출, 원문 캐릭터는 잘라냄
  const firstLine = msg.split("\n")[0]!.slice(0, 120);
  return `오류: ${firstLine}`;
}
