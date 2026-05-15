import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useCounts } from "../lib/counts";
import { IconDots, IconPlus, IconSearch, IconSpark } from "../lib/icons";
import type { Sample, StyleProfile } from "@shared/types";

export default function MyStyle() {
  const { refresh: refreshCounts } = useCounts();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const [s, p] = await Promise.all([api.samples.list(), api.style.getProfile()]);
    if (!mountedRef.current) return;
    setSamples(s);
    setProfile(p);
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const off1 = api.style.onProgress((p) => {
      if (mountedRef.current) setProgress(p);
    });
    const off2 = api.style.onWarning((w) => {
      if (mountedRef.current) setWarnings((prev) => [...prev, w]);
    });
    return () => { off1(); off2(); };
  }, []);

  const add = async () => {
    if (!body.trim()) return;
    await api.samples.add({ label: label.trim() || "(이름 없음)", body });
    if (!mountedRef.current) return;
    setLabel(""); setBody(""); setShowAdd(false);
    await refresh();
  };

  const remove = async (id: string) => {
    await api.samples.delete(id);
    if (!mountedRef.current) return;
    setMenuOpenId(null);
    await refresh();
  };

  const analyze = async () => {
    setAnalyzing(true); setWarnings([]); setAnalysisError(null); setProgress("시작");
    try {
      await api.style.analyze();
      if (!mountedRef.current) return;
      await refresh();
    } catch (e) {
      if (!mountedRef.current) return;
      setAnalysisError((e as Error).message);
    } finally {
      if (mountedRef.current) {
        setAnalyzing(false); setProgress(null);
      }
    }
  };

  const filtered = samples.filter((sample) =>
    !search || sample.label.toLowerCase().includes(search.toLowerCase()),
  );

  const totalChars = samples.reduce((sum, sample) => sum + sample.charCount, 0);
  const lastUpdated = profile?.updatedAt
    ? new Date(profile.updatedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  // Tone distribution rendering
  const toneEntries = profile
    ? Object.entries(profile.toneDistribution)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="content scroll" style={{ overflowY: "auto", maxHeight: "calc(100vh - var(--titlebar-h))" }}>
      {/* HERO */}
      <header className="ms-hero">
        <div>
          <h1 className="section-title">내 글 스타일</h1>
          <p className="section-sub">
            기존에 쓴 {samples.length}편의 글에서 학습한 말투예요. 글이 늘어날수록 더 정확해져요.
          </p>
        </div>
        <div className="ms-hero__actions">
          <button className="btn btn--secondary" onClick={() => setShowAdd((v) => !v)}>
            <IconPlus />
            새 글 추가
          </button>
          <button className="btn btn--primary" onClick={analyze}
            disabled={analyzing || samples.length === 0}>
            <IconSpark />
            {analyzing ? "분석 중…" : profile ? "다시 분석" : "스타일 분석 시작"}
          </button>
        </div>
      </header>

      {/* Add form */}
      {showAdd && (
        <section className="set-card" style={{ marginBottom: "var(--s-6)" }}>
          <header className="set-card__head">
            <div>
              <h2 className="set-card__title">새 글 추가</h2>
              <p className="set-card__sub">내가 쓴 블로그 글을 통째로 붙여넣어주세요.</p>
            </div>
          </header>
          <div className="field">
            <label className="label">라벨</label>
            <input className="input" value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예) 성수동 카페 후기" />
          </div>
          <div className="field">
            <label className="label">본문</label>
            <textarea className="textarea textarea--lg" rows={10}
              value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="블로그 글 본문을 붙여넣어주세요" />
          </div>
          <div className="result__actions" style={{ marginTop: "var(--s-3)" }}>
            <button className="btn btn--secondary" onClick={() => { setShowAdd(false); setLabel(""); setBody(""); }}>
              취소
            </button>
            <button className="btn btn--primary" onClick={add} disabled={!body.trim()}>
              저장
            </button>
          </div>
        </section>
      )}

      {/* ANALYSIS STATUS BAR */}
      <div className="ms-status">
        <div className="ms-status__row">
          <div className="ms-status__col">
            <div className="ms-status__num">{samples.length}<span className="ms-status__num-sub">/30 권장</span></div>
            <div className="ms-status__label">학습한 글</div>
          </div>
          <div className="ms-status__divider"></div>
          <div className="ms-status__col">
            <div className="ms-status__num">{totalChars.toLocaleString()}<span className="ms-status__num-sub">자</span></div>
            <div className="ms-status__label">총 글자 수</div>
          </div>
          <div className="ms-status__divider"></div>
          <div className="ms-status__col">
            <div className="ms-status__num">{lastUpdated}</div>
            <div className="ms-status__label">마지막 분석</div>
          </div>
          <div className="ms-status__col ms-status__col--right">
            <div className="ms-status__pill">
              <span className="dot"></span>
              <span>{profile ? "분석 완료" : analyzing ? "분석 중" : "분석 필요"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress / warnings */}
      {analyzing && progress && (
        <div className="validation-banner" style={{ margin: "0 var(--s-6) var(--s-6)" }}>
          <div className="validation-banner__icon">…</div>
          <div className="validation-banner__body">
            <div className="validation-banner__title">분석 중</div>
            <ul className="validation-banner__list"><li>{progress}</li></ul>
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="validation-banner" style={{ margin: "0 var(--s-6) var(--s-6)" }}>
          <div className="validation-banner__icon">!</div>
          <div className="validation-banner__body">
            <div className="validation-banner__title">주의</div>
            <ul className="validation-banner__list">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}
      {analysisError && (
        <div className="field-msg field-msg--error" style={{ margin: "0 var(--s-6) var(--s-6)" }}>
          <span className="field-msg__icon">!</span> 스타일 분석 실패: {analysisError}
        </div>
      )}

      {/* ANALYSIS GRID */}
      {profile && (
        <section className="analysis-grid">
          {/* Tone */}
          <article className="ana-card ana-card--span-2">
            <header className="ana-card__head">
              <h3 className="ana-card__title">말투 비율</h3>
              <span className="ana-card__hint">문장 끝 어미를 기준으로 분석</span>
            </header>
            <div className="bar-stack">
              <div className="bar-stack__bar">
                {toneEntries.map(([k, v], i) => (
                  <span key={k} className={`bar-seg bar-seg--${(i % 3) + 1}`}
                    style={{ width: `${(v * 100).toFixed(0)}%` }} />
                ))}
              </div>
              <ul className="bar-legend">
                {toneEntries.map(([k, v], i) => (
                  <li key={k}>
                    <span className={`dot dot--${(i % 3) + 1}`}></span>
                    <span className="label">{k}</span>
                    <span className="pct">{(v * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          {/* Avg sentence length */}
          <article className="ana-card">
            <header className="ana-card__head">
              <h3 className="ana-card__title">평균 문장 길이</h3>
            </header>
            <div className="ana-num">
              {profile.avgSentenceLength}<span className="ana-num__unit">자 / 문장</span>
            </div>
            <div className="ana-helper">
              <span className="ana-badge ana-badge--mid">
                {profile.avgSentenceLength < 30 ? "짧음" : profile.avgSentenceLength < 50 ? "중간 길이" : "긴 편"}
              </span>
              <span className="ana-helper__text">한 문장에 2~3개 정보를 담는 편이에요.</span>
            </div>
          </article>

          {/* Emoji */}
          <article className="ana-card">
            <header className="ana-card__head">
              <h3 className="ana-card__title">이모지 사용</h3>
            </header>
            <div className="ana-num">{emojiLabel(profile.emojiFrequency)}</div>
            <div className="ana-meter">
              <div className="ana-meter__track">
                <div className="ana-meter__fill" style={{ width: emojiPct(profile.emojiFrequency) }}></div>
              </div>
              <div className="ana-meter__legend">
                <span>없음</span>
                <span>낮음</span>
                <span>중간</span>
                <span>높음</span>
              </div>
            </div>
          </article>

          {/* Common expressions */}
          <article className="ana-card ana-card--span-2">
            <header className="ana-card__head">
              <h3 className="ana-card__title">자주 쓰는 표현</h3>
              <span className="ana-card__hint">2번 이상 등장한 표현</span>
            </header>
            <div className="word-cloud">
              {profile.commonExpressions.length === 0 && (
                <span className="word word--sm">아직 자주 쓰는 표현이 없어요</span>
              )}
              {profile.commonExpressions.map((w, i) => (
                <span key={w} className={`word word--${wordSize(i)}`}>{w}</span>
              ))}
            </div>
          </article>

          {/* Structure pattern */}
          <article className="ana-card">
            <header className="ana-card__head">
              <h3 className="ana-card__title">글 구조 패턴</h3>
            </header>
            <div className="ana-helper" style={{ marginTop: 0 }}>
              <span className="ana-helper__text">{profile.structureNotes}</span>
            </div>
          </article>

          <article className="ana-card">
            <header className="ana-card__head">
              <h3 className="ana-card__title">사진 묘사 스타일</h3>
            </header>
            <div className="ana-helper" style={{ marginTop: 0 }}>
              <span className="ana-helper__text">{profile.photoDescriptionStyle}</span>
            </div>
          </article>
        </section>
      )}

      {/* SAMPLES LIST */}
      <section className="ms-list">
        <div className="ms-list__head">
          <h2 className="ms-list__title">학습한 글 <span className="count">{samples.length}</span></h2>
          <div className="ms-list__actions">
            <div className="search">
              <IconSearch />
              <input placeholder="제목으로 검색"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowAdd(true)}>
              <IconPlus />
              새 글 추가
            </button>
          </div>
        </div>

        <div className="ms-table">
          <div className="ms-table__row ms-table__row--head">
            <div className="cell-label">라벨</div>
            <div className="cell-count">글자 수</div>
            <div className="cell-date">추가일</div>
            <div className="cell-action"></div>
          </div>
          {filtered.map((s) => (
            <div className="ms-table__row" key={s.id}>
              <div className="cell-label">{s.label}</div>
              <div className="cell-count">{s.charCount.toLocaleString()}자</div>
              <div className="cell-date">
                {new Date(s.createdAt).toLocaleDateString("ko-KR")}
              </div>
              <div className="cell-action" style={{ position: "relative" }}>
                <button className="btn--icon btn"
                  onClick={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}>
                  <IconDots />
                </button>
                {menuOpenId === s.id && (
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 4px)",
                    background: "var(--bg-elevated)", border: "1px solid var(--border-2)",
                    borderRadius: 8, boxShadow: "var(--shadow-2)", zIndex: 10,
                    minWidth: 120, padding: 4,
                  }}>
                    <button className="btn btn--ghost btn--sm"
                      style={{ width: "100%", justifyContent: "flex-start", color: "var(--danger)" }}
                      onClick={() => remove(s.id)}>
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="ms-table__row">
              <div className="cell-label" style={{ color: "var(--text-3)" }}>
                {samples.length === 0 ? "아직 등록된 글이 없어요. '새 글 추가'로 시작해주세요." : "검색 결과가 없어요."}
              </div>
              <div className="cell-count"></div>
              <div className="cell-date"></div>
              <div className="cell-action"></div>
            </div>
          )}
        </div>
      </section>

      <div style={{ height: 48 }}></div>
    </div>
  );
}

function emojiLabel(f: "none" | "low" | "medium" | "high"): string {
  return { none: "없음", low: "낮음", medium: "중간", high: "높음" }[f];
}

function emojiPct(f: "none" | "low" | "medium" | "high"): string {
  return { none: "0%", low: "28%", medium: "60%", high: "92%" }[f];
}

function wordSize(i: number): "xl" | "lg" | "md" | "sm" {
  if (i === 0) return "xl";
  if (i < 3) return "lg";
  if (i < 6) return "md";
  return "sm";
}
