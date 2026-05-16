import { describe, it, expect } from "vitest";
import {
  extractBlogId,
  parseRssItems,
  extractMainContainer,
  htmlToText,
  scrapeNaverBlog,
} from "@main/scrapers/naverBlog";

describe("extractBlogId", () => {
  it("extracts id from full URL", () => {
    expect(extractBlogId("https://blog.naver.com/lotus_archive4u")).toBe(
      "lotus_archive4u",
    );
  });

  it("extracts id from URL with path and query", () => {
    expect(
      extractBlogId("https://blog.naver.com/lotus_archive4u/22428?fromRss=true"),
    ).toBe("lotus_archive4u");
  });

  it("accepts bare id", () => {
    expect(extractBlogId("lotus_archive4u")).toBe("lotus_archive4u");
  });

  it("returns null for garbage", () => {
    expect(extractBlogId("not a blog!!!")).toBeNull();
    expect(extractBlogId("")).toBeNull();
  });
});

describe("parseRssItems", () => {
  it("parses items with CDATA wrapped fields", () => {
    const xml = `
      <rss><channel>
        <item>
          <title><![CDATA[ 첫번째 글 ]]></title>
          <link><![CDATA[https://blog.naver.com/lotus_archive4u/224284484760?fromRss=true]]></link>
          <pubDate>Wed, 01 Jan 2025 12:00:00 +0900</pubDate>
        </item>
        <item>
          <title><![CDATA[두번째 글]]></title>
          <link><![CDATA[https://blog.naver.com/lotus_archive4u/100000000001]]></link>
        </item>
      </channel></rss>`;
    const out = parseRssItems(xml, 10);
    expect(out).toHaveLength(2);
    expect(out[0]?.postNo).toBe("224284484760");
    expect(out[0]?.title).toBe("첫번째 글");
    expect(out[1]?.postNo).toBe("100000000001");
  });

  it("limits result count", () => {
    const xml = `
      <rss><channel>
        ${Array.from({ length: 5 })
          .map(
            (_, i) =>
              `<item><title><![CDATA[${i}]]></title><link><![CDATA[https://blog.naver.com/a/${i}00]]></link></item>`,
          )
          .join("")}
      </channel></rss>`;
    expect(parseRssItems(xml, 3)).toHaveLength(3);
  });
});

describe("extractMainContainer", () => {
  it("returns inner of se-main-container, handling nested divs", () => {
    const html = `
      <html><body>
        <div class="se-main-container">
          <div class="se-component"><p>hello</p></div>
          <div class="se-component"><p>world</p></div>
        </div>
        <div class="other"></div>
      </body></html>`;
    const inner = extractMainContainer(html);
    expect(inner).toContain("hello");
    expect(inner).toContain("world");
    expect(inner).not.toContain("other");
  });

  it("returns empty when container missing", () => {
    expect(extractMainContainer("<div>no</div>")).toBe("");
  });
});

describe("htmlToText", () => {
  it("strips tags, decodes entities, normalises whitespace", () => {
    const html =
      "<p>안녕<br>하세요</p><p>두번째&nbsp;단락 &amp; 끝</p><img src='x'/>";
    const text = htmlToText(html);
    expect(text).toContain("안녕\n하세요");
    expect(text).toContain("두번째 단락 & 끝");
    expect(text).not.toContain("<");
  });
});

describe("scrapeNaverBlog (with deps)", () => {
  it("calls list+body and returns posts; skips short bodies", async () => {
    const posts = await scrapeNaverBlog(
      "https://blog.naver.com/myblog",
      3,
      undefined,
      {
        fetchList: async () => [
          { postNo: "1", title: "긴 글" },
          { postNo: "2", title: "짧은 글" },
          { postNo: "3", title: "다른 긴 글" },
        ],
        fetchBody: async (_id, postNo) => {
          if (postNo === "2") return { body: "짧음", bodyHtml: "<p>짧음</p>" };
          return {
            body: "a".repeat(200),
            bodyHtml: `<p>${postNo}</p>`,
          };
        },
        delayMs: 0,
      },
    );
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.postNo)).toEqual(["1", "3"]);
  });

  it("throws on invalid blog id", async () => {
    await expect(
      scrapeNaverBlog("???", 1, undefined, {
        fetchList: async () => [],
        fetchBody: async () => ({ body: "", bodyHtml: "" }),
        delayMs: 0,
      }),
    ).rejects.toThrow();
  });

  it("reports progress", async () => {
    const events: number[] = [];
    await scrapeNaverBlog(
      "blogid",
      2,
      (p) => events.push(p.done),
      {
        fetchList: async () => [
          { postNo: "1", title: "a" },
          { postNo: "2", title: "b" },
        ],
        fetchBody: async () => ({ body: "x".repeat(200), bodyHtml: "" }),
        delayMs: 0,
      },
    );
    expect(events[0]).toBe(0);
    expect(events[events.length - 1]).toBe(2);
  });
});
