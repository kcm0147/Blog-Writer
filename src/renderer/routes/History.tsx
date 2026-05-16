import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useCounts } from "../lib/counts";
import { IconCopy, IconSearch, IconTrash } from "../lib/icons";
import type { HistoryRecord, PostType } from "@shared/types";

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

  const refresh = async () => {
    setRecords(await api.history.list());
    await refreshCounts();
  };
  useEffect(() => { void refresh(); }, []);

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

  // Group by week
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
                  <span className="hist-card__chars">{r.body.length.toLocaleString()}자</span>
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

      {open && <DetailModal record={open} onClose={() => setOpen(null)} onDelete={remove} />}
    </div>
  );
}

function DetailModal({ record, onClose, onDelete }: {
  record: HistoryRecord;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const copyBody = () => navigator.clipboard.writeText(record.body);
  const copyHashtags = () => navigator.clipboard.writeText(record.hashtags.map((h) => `#${h}`).join(" "));
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

          <div className="result__body-card">
            <div className="result__section-title">본문</div>
            <div className="result__body" style={{ whiteSpace: "pre-wrap" }}>
              {record.body}
            </div>
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

          <div className="result__actions">
            <button className="btn btn--secondary" onClick={() => onDelete(record.id)}>
              <IconTrash />
              삭제
            </button>
            <button className="btn btn--secondary" onClick={onClose}>닫기</button>
            <button className="btn btn--primary" onClick={copyBody}>
              <IconCopy />
              본문 복사
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function previewOf(body: string): string {
  const stripped = body.replace(/\[사진\d+\]/g, "").replace(/\s+/g, " ").trim();
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
