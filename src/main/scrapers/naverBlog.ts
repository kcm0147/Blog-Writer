/**
 * 네이버 블로그 URL/ID로부터 글 목록 fetch + 본문 추출.
 *
 * Naver는 봇 차단이 있어서:
 * - Mozilla User-Agent
 * - 글 간 1초 sleep
 * - 최대 limit개만
 *
 * RSS: https://rss.blog.naver.com/{id}.xml
 *  → <item><link>https://blog.naver.com/{id}/{postNo}?...</link></item> 추출
 * 본문: https://blog.naver.com/PostView.naver?blogId={id}&logNo={postNo}
 *  → div.se-main-container 내 p.se-text-paragraph 텍스트만 추출
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface NaverPost {
  postNo: string;
  title: string;
  body: string; // 텍스트 본문 (HTML 제거)
  bodyHtml: string; // 원본 HTML (스타일 보존용)
  publishedAt?: string;
}

export interface ScrapeProgress {
  total: number;
  done: number;
  currentTitle?: string;
  skippedTitle?: string;
  skippedReason?: "short_body" | "fetch_failed";
}

export interface PostListItem {
  postNo: string;
  title: string;
  publishedAt?: string;
}

/** Naver 블로그 URL 또는 ID에서 blogId 추출 */
export function extractBlogId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/blog\.naver\.com\/([A-Za-z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) return urlMatch[1];
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m || !m[1]) return undefined;
  return stripCdata(m[1]);
}

/** RSS XML 파싱 → 최신 limit개 글 메타데이터 */
export function parseRssItems(xml: string, limit: number): PostListItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items
    .slice(0, limit)
    .map((m) => {
      const block = m[1] ?? "";
      const title = extractTag(block, "title") ?? "(제목 없음)";
      const link = extractTag(block, "link") ?? "";
      const pubDate = extractTag(block, "pubDate");
      const pm =
        link.match(/blog\.naver\.com\/[^/]+\/(\d+)/) ||
        link.match(/logNo=(\d+)/);
      return {
        postNo: pm && pm[1] ? pm[1] : "",
        title: title.replace(/^\s+|\s+$/g, ""),
        publishedAt: pubDate,
      };
    })
    .filter((p) => p.postNo);
}

/** RSS에서 글 목록 가져오기 (최신 limit개) */
export async function fetchPostList(
  blogId: string,
  limit: number,
): Promise<PostListItem[]> {
  const url = `https://rss.blog.naver.com/${blogId}.xml`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`RSS fetch 실패: ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, limit);
}

/** Smart Editor 본문 추출 — div.se-main-container 안만 가져옴 */
export function extractMainContainer(html: string): string {
  // se-main-container ~ 다음 형제 영역 시작 직전까지
  const start = html.indexOf('class="se-main-container"');
  if (start === -1) return "";
  // 시작 div의 여는 태그 끝
  const openEnd = html.indexOf(">", start);
  if (openEnd === -1) return "";
  // 닫는 짝 div 찾기 — depth 계산
  let depth = 1;
  let i = openEnd + 1;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      i = nextClose + 6;
    }
  }
  return html.slice(openEnd + 1, Math.max(openEnd + 1, i - 6));
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** 한 글의 본문 추출 */
export async function fetchPostBody(
  blogId: string,
  postNo: string,
): Promise<{ body: string; bodyHtml: string }> {
  const url =
    `https://blog.naver.com/PostView.naver?blogId=${blogId}` +
    `&logNo=${postNo}&redirect=Dlog&widgetTypeCall=true&directAccess=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`본문 fetch 실패: ${res.status}`);
  const html = await res.text();
  const bodyHtml = extractMainContainer(html);
  const body = htmlToText(bodyHtml);
  return { body, bodyHtml };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 메인: 블로그 URL/ID로부터 N개 글 스크랩 */
export async function scrapeNaverBlog(
  input: string,
  limit: number,
  onProgress?: (p: ScrapeProgress) => void,
  deps?: {
    fetchList?: (blogId: string, limit: number) => Promise<PostListItem[]>;
    fetchBody?: (
      blogId: string,
      postNo: string,
    ) => Promise<{ body: string; bodyHtml: string }>;
    delayMs?: number;
  },
): Promise<NaverPost[]> {
  const blogId = extractBlogId(input);
  if (!blogId) {
    throw new Error("올바른 네이버 블로그 URL 또는 ID가 아닙니다.");
  }

  const fetchList = deps?.fetchList ?? fetchPostList;
  const fetchBody = deps?.fetchBody ?? fetchPostBody;
  const delayMs = deps?.delayMs ?? 1000;

  console.log(`[scrape] 시작 — blogId=${blogId}, limit=${limit}`);
  const list = await fetchList(blogId, limit);
  console.log(`[scrape] RSS 글 목록 ${list.length}개 수신`);
  const results: NaverPost[] = [];

  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    console.log(`[scrape] (${i + 1}/${list.length}) "${p.title}" 본문 추출 중...`);
    onProgress?.({ total: list.length, done: i, currentTitle: p.title });
    try {
      const { body, bodyHtml } = await fetchBody(blogId, p.postNo);
      if (body.length > 100) {
        results.push({
          postNo: p.postNo,
          title: p.title,
          body,
          bodyHtml,
          publishedAt: p.publishedAt,
        });
      } else {
        onProgress?.({
          total: list.length,
          done: i + 1,
          skippedTitle: p.title,
          skippedReason: "short_body",
        });
      }
    } catch (e) {
      console.warn(`Skip ${p.postNo}:`, (e as Error).message);
      onProgress?.({
        total: list.length,
        done: i + 1,
        skippedTitle: p.title,
        skippedReason: "fetch_failed",
      });
    }
    if (i < list.length - 1 && delayMs > 0) await sleep(delayMs);
  }
  onProgress?.({ total: list.length, done: list.length });
  return results;
}
