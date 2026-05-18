import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useCounts } from "../lib/counts";
import { IconCopy, IconSearch, IconTrash } from "../lib/icons";
import type { HistoryRecord, PostType, StyleProfile, ImageInput } from "@shared/types";
import { buildStyledHtml, baseStyleFromFormatting, copyStyledHtml } from "../lib/naver-preview";

const FILTERS: Array<{ value: "all" | PostType; label: string }> = [
  { value: "all", label: "전체" },
  { value: "맛집", label: "맛집" },
  { value: "카페", label: "카페" },
  { value: "여행", label: "여행" },
  { value: "기타", label: "기타" },
];

const TAG_CLASS: Record<PostType, string> = {
  "맛집": "ms-tag--food",
  "카페": "ms-tag--cafe",
  "여행": "ms-tag--travel",
  "기타": "ms-tag--other",
};

export default function History() {
  const { refresh: refreshCounts } = useCounts();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [open, setOpen] = useState<HistoryRecord | null>(null);
  const [filter, setFilter] = useState<"all" | PostType>("all");
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<StyleProfile | null>(null);

  const refresh = async () => {
    setRecords(await api.history.list());
    await refreshCounts();
  };
  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    void api.style.getProfile().then((p) => setProfile(p));
  }, []);

  const remove = async (id: string) => {
    await api.history.delete(id);
    if (open?.id === id) setOpen(null);
    await refresh();
  };

  const filtered = useMemo(() => {
    let xs = records;
    if (filter !== "all") xs = xs.filter((r) => r.postType === filter);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.storeName.toLowerCase().includes(q) ||
        r.hashtags.some((h) => h.toLowerCase().includes(q)),
      );
    }
    return xs;
  }, [records, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: records.length };
    for (const r of records) c[r.postType] = (c[r.postType] || 0) + 1;
    return c;
  }, [records]);

  const groups = useMemo(() => groupByPeriod(filtered), [filtered]);

  return (
    <div className="content scroll" style={{ overflowY: "auto", maxHeight: "calc(100vh - var(--titlebar-h))" }}>
      <header className="hist-hero">
        <h1 className="section-title">히스토리</h1>
        <p className="section-sub">지금까지 만든 글을 다시 열어보고, 편집하거나 다시 복사할 수 있어요.</p>
      </header>

      <div className="hist-toolbar">
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f.value}
              className={filter === f.value ? "is-active" : ""}
              onClick={() => setFilter(f.value)}>
              {f.label} <span className="seg-count">{counts[f.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="hist-toolbar__right">
          <div className="search">
            <IconSearch />
            <input placeholder="매장명·키워드로 검색"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {records.length === 0 && (
        <div className="result-empty" style={{ padding: "var(--s-12) var(--s-6)" }}>
          <h2 className="result-empty__title">아직 생성한 글이 없어요</h2>
          <p className="result-empty__body">'글 작성'에서 첫 글을 만들어보세요.</p>
        </div>
      )}

      {groups.map((g) => (
        <section className="hist-section" key={g.label}>
          <h2 className="hist-section__title">{g.label} <span>{g.items.length}</span></h2>
          <div className="hist-grid">
            {g.items.map((r) => (
              <article className="hist-card" key={r.id} onClick={() => setOpen(r)}
                style={{ cursor: "pointer" }}>
                <div className="hist-card__top">
                  <span className={`ms-tag ${TAG_CLASS[r.postType] ?? "ms-tag--other"}`}>{r.postType}</span>
                  <span className="hist-card__date">{formatShortDate(r.createdAt)}</span>
                </div>
                <h3 className="hist-card__title">{r.title}</h3>
                <p className="hist-card__preview">{previewOf(r.body)}</p>
                <div className="hist-card__foot">
                  <span className="hist-card__chars">{r.body.replace(/\s/g, '').length.toLocaleString()}자</span>
                  <span className="hist-card__sep">·</span>
                  <span className="hist-card__tags">
                    {r.hashtags.slice(0, 2).map((h) => `#${h}`).join(" ")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <div style={{ height: 64 }}></div>

      {open && <DetailModal record={open} profile={profile} onClose={() => setOpen(null)} onDelete={remove} />}
    </div>
  );
}

function DetailModal({ record, profile, onClose, onDelete }: {
  record: HistoryRecord;
  profile: StyleProfile | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"preview" | "text">("preview");
  const [images, setImages] = useState<ImageInput[]>([]);

  useEffect(() => {
    void api.history.getImages(record.id).then((imgs) => setImages(imgs));
  }, [record.id]);

  const hasFormatting = Boolean(
    profile?.formatting && (
      profile.formatting.fontFamily ||
      profile.formatting.bodyFontSize ||
      profile.formatting.primaryColor ||
      profile.formatting.paragraphAlign
    ),
  );

  const copyBody = () => navigator.clipboard.writeText(record.body);
  const copyHashtags = () => navigator.clipboard.writeText(record.hashtags.map((h) => `#${h}`).join(" "));

  // 기능 3: 사진 가이드 포함 복사
  const copyWithPhotoGuide = () => {
    const mapEntries = Object.entries(record.imageMap);
    const guide = record.body + "\n\n" +
      "─────── 📸 사진 삽입 가이드 ───────\n" +
      "네이버 에디터에서 아래 순서대로 사진을 삽입해주세요:\n\n" +
      mapEntries.map(([marker, filename], i) =>
        `${i + 1}. ${marker} 위치 → ${filename}`
      ).join("\n") +
      "\n───────────────────────────────";
    void navigator.clipboard.writeText(guide);
  };

  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const copyStyled = async () => {
    try {
      await copyStyledHtml(record.body, profile);
      setCopyMsg("서식 복사 완료! 네이버 에디터에 Ctrl+V 하세요");
      setTimeout(() => setCopyMsg(null), 3000);
    } catch {
      setCopyMsg("복사 실패");
      setTimeout(() => setCopyMsg(null), 2000);
    }
  };

  const hasImageMap = Object.keys(record.imageMap).length > 0;
  const styledHtml = buildStyledHtml(record.body, profile, images);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-elevated)", borderRadius: 16,
        maxWidth: 760, width: "100%", maxHeight: "90vh", overflow: "auto",
        boxShadow: "var(--shadow-3)",
      }}>
        <div className="result" style={{ padding: "var(--s-6)" }}>
          <header className="result__header">
            <span className="result__badge">
              <span className="dot"></span>
              {record.storeName} · {record.postType}
            </span>
            <span className="result__meta">{new Date(record.createdAt).toLocaleString("ko-KR")}</span>
          </header>

          <div className="result__title-card">
            <div className="result__title-label">제목</div>
            <input className="result__title-input" value={record.title} readOnly />
          </div>

          {/* 탭 전환 */}
          <div className="seg is-full" role="tablist" style={{ marginBottom: "var(--s-3)" }}>
            <button
              className={tab === "preview" ? "is-active" : ""}
              onClick={() => setTab("preview")}>
              서식 미리보기
            </button>
            <button
              className={tab === "text" ? "is-active" : ""}
              onClick={() => setTab("text")}>
              원문 텍스트
            </button>
          </div>

          <div className="result__body-card">
            <div className="result__section-title">
              {tab === "preview" ? "서식 미리보기" : "본문"}
              {tab === "preview" && hasFormatting && (
                <span className="btn-link" style={{ marginLeft: 8 }}>서식 적용됨</span>
              )}
              {tab === "text" && (
                <span className="btn-link" style={{ marginLeft: 8 }}>
                  {record.body.replace(/\s/g, '').length.toLocaleString()}자
                </span>
              )}
            </div>
            {tab === "preview" ? (
              <iframe
                title="서식 미리보기"
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body { margin: 0; padding: 16px; ${baseStyleFromFormatting(profile?.formatting)} } p { margin: 0 0 1em; } strong { font-weight: 700; } img { max-width: 100%; height: auto; }</style></head><body>${styledHtml}</body></html>`}
                sandbox=""
                style={{
                  width: "100%", minHeight: "400px",
                  border: "1px solid var(--border-1)",
                  borderRadius: "var(--r-md, 8px)",
                  background: "#fff",
                }}
              />
            ) : (
              <div className="result__body" style={{ whiteSpace: "pre-wrap" }}>
                {record.body}
              </div>
            )}
          </div>

          <div className="result__hashtags">
            <div className="result__section-title">
              해시태그 · {record.hashtags.length}개
              <span className="btn-link" onClick={copyHashtags} style={{ cursor: "pointer" }}>
                <IconCopy />
                전체 복사
              </span>
            </div>
            <div className="hashtags">
              {record.hashtags.map((h) => <span className="tag" key={h}>#{h}</span>)}
            </div>
          </div>

          {/* 사진 매핑 + 가이드 복사 */}
          {hasImageMap && (
            <div className="result__map">
              <div className="result__section-title">
                📸 사진 삽입 순서
                <span className="btn-link" onClick={copyWithPhotoGuide} style={{ cursor: "pointer" }}>
                  <IconCopy />
                  본문 + 사진 가이드 복사
                </span>
              </div>
              <table className="map-table">
                <tbody>
                  {Object.entries(record.imageMap).map(([marker, filename], i) => (
                    <tr key={marker}>
                      <td>
                        <span className="marker-cell">
                          <span className="num">{i + 1}</span>
                          <span className="file">{filename}</span>
                        </span>
                      </td>
                      <td className="desc">{marker} 위치에 삽입</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="result__actions">
            <button className="btn btn--secondary" onClick={() => void onDelete(record.id)}>
              <IconTrash />
              삭제
            </button>
            <button className="btn btn--secondary" onClick={onClose}>닫기</button>
            {hasImageMap && (
              <button className="btn btn--secondary" onClick={copyWithPhotoGuide}>
                <IconCopy />
                사진 가이드 포함 복사
              </button>
            )}
            <button className="btn btn--primary" onClick={copyStyled}>
              <IconCopy />
              서식 복사 (네이버용)
            </button>
          </div>
          {copyMsg && (
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
              {copyMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function previewOf(body: string): string {
  const stripped = body.replace(/\[사진\d+\]/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > 140 ? stripped.slice(0, 140) + "…" : stripped;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function groupByPeriod(records: HistoryRecord[]): Array<{ label: string; items: HistoryRecord[] }> {
  if (records.length === 0) return [];
  const now = new Date();
  const startOfWeek = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - x.getDay());
    return x;
  };
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek: HistoryRecord[] = [];
  const lastWeek: HistoryRecord[] = [];
  const older: HistoryRecord[] = [];
  for (const r of records) {
    const t = new Date(r.createdAt).getTime();
    if (t >= thisWeekStart.getTime()) thisWeek.push(r);
    else if (t >= lastWeekStart.getTime()) lastWeek.push(r);
    else older.push(r);
  }
  const groups: Array<{ label: string; items: HistoryRecord[] }> = [];
  if (thisWeek.length) groups.push({ label: "이번 주", items: thisWeek });
  if (lastWeek.length) groups.push({ label: "지난 주", items: lastWeek });
  if (older.length) groups.push({ label: "이전", items: older });
  return groups;
}
