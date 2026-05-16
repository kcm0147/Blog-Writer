import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useCounts } from "../lib/counts";
import {
  IconArrow, IconCopy, IconImage, IconPlus, IconRefresh, IconAlert, IconLock,
  IconCheck, IconInfo,
} from "../lib/icons";
import type {
  GenerateInput, ImageInput, PostType, StyleProfile, Tone,
} from "@shared/types";
import type { GenerateOutcome } from "@shared/api";

type Phase = "idle" | "validation" | "loading" | "result" | "error";

const POST_TYPES: { value: PostType; label: string }[] = [
  { value: "맛집", label: "맛집 후기" },
  { value: "카페", label: "카페" },
  { value: "여행", label: "여행" },
  { value: "기타", label: "기타" },
];
const LENGTHS = [500, 1000, 1500, 2000];
const TONES: { value: Tone; label: string }[] = [
  { value: "my_style", label: "내 스타일" },
  { value: "해요", label: "해요체" },
  { value: "합니다", label: "합니다체" },
  { value: "반말", label: "반말" },
];

const MIN_MEMO_CHARS = 50;

interface MissingFields {
  storeName: boolean;
  address: boolean;
  memo: { missing: boolean; short: boolean; chars: number };
}

function validate(storeName: string, address: string, memo: string): MissingFields {
  const memoLen = memo.trim().length;
  return {
    storeName: storeName.trim().length === 0,
    address: address.trim().length === 0,
    memo: { missing: memoLen === 0, short: memoLen > 0 && memoLen < MIN_MEMO_CHARS, chars: memoLen },
  };
}

function missingCount(m: MissingFields): number {
  let n = 0;
  if (m.storeName) n++;
  if (m.address) n++;
  if (m.memo.missing || m.memo.short) n++;
  return n;
}

function buildStyledHtml(body: string, profile: StyleProfile | null): string {
  const formatting = profile?.formatting;
  const align = formatting?.paragraphAlign ?? "left";
  const color = formatting?.primaryColor ?? "";
  const fontFamily = formatting?.fontFamily ?? "";
  const bodyFontSize = formatting?.bodyFontSize
    ? `${formatting.bodyFontSize}px`
    : "";
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
      const safe = p
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      return `<p style="${styles}">${safe}</p>`;
    })
    .join("");
}

export default function Compose() {
  const { refresh: refreshCounts, samples, settings } = useCounts();
  const [profile, setProfile] = useState<StyleProfile | null | undefined>(undefined);
  const hasApiKey: boolean | null = settings
    ? settings.hasApiKey[settings.provider]
    : null;
  const useWebSearchSetting = settings?.useWebSearch ?? false;

  // form fields
  const [postType, setPostType] = useState<PostType>("맛집");
  const [postTypeExtra, setPostTypeExtra] = useState("");
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [length, setLength] = useState(1500);
  const [tone, setTone] = useState<Tone>("my_style");
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [emphasis, setEmphasis] = useState("");
  const [memo, setMemo] = useState("");
  const [images, setImages] = useState<ImageInput[]>([]);

  // flow state
  const [phase, setPhase] = useState<Phase>("idle");
  const [showValidation, setShowValidation] = useState(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GenerateOutcome | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const photoNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => () => {
    if (photoNoticeTimerRef.current) clearTimeout(photoNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    void api.style.getProfile().then((p) => {
      if (mountedRef.current) setProfile(p);
    });
  }, []);

  useEffect(() => {
    const off = api.generate.onProgress((stage) => {
      if (mountedRef.current) setProgressStage(stage);
    });
    return () => off();
  }, []);

  const validation = useMemo(
    () => validate(storeName, address, memo),
    [storeName, address, memo],
  );
  const missing = missingCount(validation);

  const memoChars = memo.trim().length;

  // --- File handling ---
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 10 - images.length;
    if (files.length > remaining) {
      const excess = files.length - remaining;
      setPhotoNotice(`사진은 최대 10장까지만 첨부할 수 있어요. ${excess}장은 제외됐습니다.`);
      if (photoNoticeTimerRef.current) clearTimeout(photoNoticeTimerRef.current);
      photoNoticeTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setPhotoNotice(null);
      }, 5000);
    }
    const next: ImageInput[] = [];
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const f = files[i];
      if (!f) continue;
      try {
        const buf = await f.arrayBuffer();
        next.push(await api.images.prepare(f.name, new Uint8Array(buf)));
      } catch (e) {
        console.error("image prepare failed", e);
      }
    }
    if (!mountedRef.current) return;
    setImages((prev) => [...prev, ...next].slice(0, 10));
  };

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));

  // --- Keyword chips ---
  const addKeyword = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (keywords.length >= 5) return;
    if (keywords.includes(v)) { setKeywordDraft(""); return; }
    setKeywords((prev) => [...prev, v]);
    setKeywordDraft("");
  };
  const removeKeyword = (i: number) =>
    setKeywords((prev) => prev.filter((_, j) => j !== i));

  // --- Submit ---
  const onSubmit = async () => {
    if (missing > 0) {
      setShowValidation(true);
      setPhase("validation");
      return;
    }
    setShowValidation(false);
    setPhase("loading");
    setProgressStage("준비 중");
    setOutcome(null);
    setErrorMessage(null);

    const effectiveEmphasis = postType === "기타" && postTypeExtra.trim()
      ? `[세부 타입: ${postTypeExtra.trim()}] ${emphasis.trim()}`.trim()
      : emphasis.trim();

    const input: GenerateInput = {
      info: {
        storeName: storeName.trim(),
        address: address.trim(),
        visitDate: visitDate || undefined,
        postType,
        title: title.trim() || undefined,
        keywords: keywords.slice(0, 5),
        length,
        tone,
        emphasis: effectiveEmphasis,
      },
      memo: memo.trim(),
      images,
      useWebSearch: useWebSearchSetting,
    };

    try {
      const res = await api.generate.run(input);
      if (!mountedRef.current) return;
      setOutcome(res);
      setPhase("result");
      await refreshCounts();
    } catch (e) {
      if (!mountedRef.current) return;
      setErrorMessage((e as Error).message || "알 수 없는 오류");
      setPhase("error");
    } finally {
      if (mountedRef.current) setProgressStage(null);
    }
  };

  const onReset = useCallback(() => {
    setStoreName(""); setAddress(""); setVisitDate("");
    setPostType("맛집"); setPostTypeExtra("");
    setTitle(""); setKeywords([]); setKeywordDraft("");
    setEmphasis(""); setMemo(""); setImages([]);
    setLength(1500); setTone("my_style");
    setShowValidation(false); setPhase("idle"); setOutcome(null); setErrorMessage(null);
    setPhotoNotice(null);
    if (photoNoticeTimerRef.current) {
      clearTimeout(photoNoticeTimerRef.current);
      photoNoticeTimerRef.current = null;
    }
  }, []);

  // Profile / API key gating
  const profileLoading = profile === undefined;
  const noProfile = profile === null;
  const noKey = hasApiKey !== true;

  // --- Footer ---
  const submitDisabled = phase === "loading" || profileLoading || noProfile || noKey;

  return (
    <div className="compose">
      {/* LEFT — INPUT PANEL */}
      <section className="compose__input scroll">
        <header className="compose__header">
          <h1 className="compose__title">새 글 만들기</h1>
          <p className="compose__sub">방문한 곳의 정보와 사진, 메모를 넣어주세요.</p>
        </header>

        {!profileLoading && noProfile && (
          <div className="validation-banner">
            <div className="validation-banner__icon">!</div>
            <div className="validation-banner__body">
              <div className="validation-banner__title">스타일 분석을 먼저 해주세요</div>
              <ul className="validation-banner__list">
                <li><Link to="/style" className="link">내 스타일</Link>에서 글을 등록하고 분석을 시작해주세요.</li>
              </ul>
            </div>
          </div>
        )}

        {!profileLoading && noKey && !noProfile && (
          <div className="validation-banner">
            <div className="validation-banner__icon">!</div>
            <div className="validation-banner__body">
              <div className="validation-banner__title">API 키가 설정되지 않았어요</div>
              <ul className="validation-banner__list">
                <li><Link to="/settings" className="link">설정</Link>에서 API 키를 입력해주세요.</li>
              </ul>
            </div>
          </div>
        )}

        {showValidation && missing > 0 && (
          <div className="validation-banner">
            <div className="validation-banner__icon">!</div>
            <div className="validation-banner__body">
              <div className="validation-banner__title">{missing}개 항목을 확인해주세요</div>
              <ul className="validation-banner__list">
                {validation.storeName && <li>매장명</li>}
                {validation.address && <li>매장 주소</li>}
                {(validation.memo.missing || validation.memo.short) && (
                  <li>방문 메모 ({MIN_MEMO_CHARS}자 이상)</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Group 1 */}
        <div className="form-group">
          <div className="form-group__head">
            <span className="form-group__num">01</span>
            <span className="form-group__name">어떤 글인가요?</span>
          </div>

          <div className="field field--seg-with-extra">
            <label className="label">글 타입</label>
            <div className="seg is-full" role="tablist">
              {POST_TYPES.map((t) => (
                <button key={t.value}
                  className={postType === t.value ? "is-active" : ""}
                  onClick={() => setPostType(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
            {postType === "기타" && (
              <div className="seg-extra">
                <span className="seg-extra__label">세부 타입</span>
                <input className="seg-extra__input"
                  value={postTypeExtra}
                  onChange={(e) => setPostTypeExtra(e.target.value)}
                  placeholder="예) 전시 후기, 도서 리뷰, 운동 공간 …" />
                <span className="seg-extra__hint">해시태그 일부가 이 단어로 만들어져요</span>
              </div>
            )}
          </div>

          <div className="row-2">
            <div className={"field" + (showValidation && validation.storeName ? " field--has-error" : "")}>
              <label className="label">매장명 <span className="req">*</span></label>
              <input className={"input" + (showValidation && validation.storeName ? " is-error" : "")}
                value={storeName} onChange={(e) => setStoreName(e.target.value)}
                placeholder="예) 한남동 미스터홍" />
              {showValidation && validation.storeName && (
                <span className="field-msg field-msg--error">
                  <span className="field-msg__icon">!</span>
                  매장명을 입력해주세요
                </span>
              )}
            </div>
            <div className="field">
              <label className="label">방문일 <span className="hint">선택</span></label>
              <input className="input" type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)} />
            </div>
          </div>

          <div className={"field" + (showValidation && validation.address ? " field--has-error" : "")}>
            <label className="label">매장 주소 <span className="req">*</span></label>
            <input className={"input" + (showValidation && validation.address ? " is-error" : "")}
              value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="서울 용산구 이태원로 ..." />
            {showValidation && validation.address && (
              <span className="field-msg field-msg--error">
                <span className="field-msg__icon">!</span>
                매장 주소를 입력해주세요
              </span>
            )}
          </div>
        </div>

        {/* Group 2 — Photos */}
        <div className="form-group">
          <div className="form-group__head">
            <span className="form-group__num">02</span>
            <span className="form-group__name">사진</span>
            <span className="form-group__hint">AI가 사진을 직접 보고 글에 반영해요</span>
          </div>

          <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
            <div className="dropzone__icon"><IconImage /></div>
            <div className="dropzone__title">사진을 끌어 놓거나 <u>찾아보기</u></div>
            <div className="dropzone__hint">JPG · PNG · 최대 10장, 5MB 이상은 자동 리사이즈</div>
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png"
              multiple style={{ display: "none" }}
              onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {images.length > 0 && (
            <div className="thumbs">
              {images.map((img, i) => (
                <div className="thumb" key={`${img.filename}-${i}`}>
                  <div className="thumb__num">{i + 1}</div>
                  <div className="thumb__img"
                    style={{ background: `url(data:${img.mediaType};base64,${img.base64}) center/cover` }} />
                  <div className="thumb__name">{img.filename}</div>
                  <button className="thumb__x" aria-label="삭제"
                    onClick={() => removeImage(i)}>×</button>
                </div>
              ))}
              {images.length < 10 && (
                <div className="thumb thumb--add" onClick={() => fileInputRef.current?.click()}>
                  <IconPlus width={20} height={20} />
                  <span>추가</span>
                </div>
              )}
            </div>
          )}
          {photoNotice && (
            <div className="field-msg field-msg--warn" style={{ marginTop: 8 }}>
              <span className="field-msg__icon">!</span>{photoNotice}
            </div>
          )}
          <div className="form-helper">사진을 끌어서 순서를 바꿀 수 있어요. 본문의 <code>[사진1]</code> 마커가 위 순서와 매칭돼요.</div>
        </div>

        {/* Group 3 — length / tone */}
        <div className="form-group">
          <div className="form-group__head">
            <span className="form-group__num">03</span>
            <span className="form-group__name">분량과 말투</span>
          </div>

          <div className="field">
            <label className="label">글자 수</label>
            <div className="seg is-full">
              {LENGTHS.map((n) => (
                <button key={n}
                  className={length === n ? "is-active" : ""}
                  onClick={() => setLength(n)}>
                  {n}자{n === 1500 && <span className="badge-mini">기본</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">말투</label>
            <div className="seg is-full">
              {TONES.map((t) => (
                <button key={t.value}
                  className={tone === t.value ? "is-active" : ""}
                  onClick={() => setTone(t.value)}>
                  {t.label}{t.value === "my_style" && <span className="badge-mini">기본</span>}
                </button>
              ))}
            </div>
            <div className="helper">'내 스타일'은 분석된 {samples}개의 글에서 학습된 말투예요.</div>
          </div>
        </div>

        {/* Group 4 — details */}
        <div className="form-group">
          <div className="form-group__head">
            <span className="form-group__num">04</span>
            <span className="form-group__name">디테일</span>
          </div>

          <div className="field">
            <label className="label">글 제목 <span className="hint">비워두면 AI가 추천해요</span></label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 한남동 데이트하기 좋은 베트남 음식점" />
          </div>

          <div className="field">
            <label className="label">SEO 키워드 <span className="hint">최대 5개</span></label>
            <div className="tag-input">
              {keywords.map((k, i) => (
                <span key={i} className="chip chip--solid">
                  {k}{" "}
                  <span className="x" onClick={() => removeKeyword(i)}>×</span>
                </span>
              ))}
              <input className="tag-input__entry"
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addKeyword(keywordDraft); }
                  else if (e.key === "Backspace" && keywordDraft === "" && keywords.length > 0) {
                    removeKeyword(keywords.length - 1);
                  }
                }}
                onBlur={() => keywordDraft && addKeyword(keywordDraft)}
                placeholder={keywords.length >= 5 ? "" : "키워드 입력 후 Enter"} />
            </div>
          </div>

          <div className="field">
            <label className="label">강조 / 제외 사항</label>
            <textarea className="textarea" rows={3}
              value={emphasis} onChange={(e) => setEmphasis(e.target.value)}
              placeholder="예) 친구랑 오후 2시 방문. '직접 결제했다'는 표현은 빼줘. 2030 타겟." />
          </div>

          <div className={"field" + (showValidation && (validation.memo.missing || validation.memo.short) ? " field--has-error" : "")}>
            <label className="label">방문 메모 <span className="req">*</span></label>
            <textarea className={"textarea textarea--lg" + (showValidation && (validation.memo.missing || validation.memo.short) ? " is-error" : "")}
              rows={7} value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder="이번 방문의 키워드, 감상, 디테일을 자유롭게 적어주세요. 자세할수록 좋아요." />
            <div className="helper">
              <span className="char-count">{memoChars}자</span> · {memoChars < MIN_MEMO_CHARS
                ? `최소 ${MIN_MEMO_CHARS}자 이상 필요해요`
                : memoChars >= 200 ? "충분한 디테일이에요 ✨" : "200자 이상이면 더 풍부한 글이 나와요"}
            </div>
            {showValidation && validation.memo.short && (
              <span className="field-msg field-msg--error">
                <span className="field-msg__icon">!</span>
                {memoChars}자입니다 · 최소 {MIN_MEMO_CHARS}자 이상 필요해요
              </span>
            )}
            {showValidation && validation.memo.missing && (
              <span className="field-msg field-msg--error">
                <span className="field-msg__icon">!</span>
                방문 메모를 입력해주세요
              </span>
            )}
          </div>
        </div>

        <div className="form-spacer" />
      </section>

      {/* RIGHT — result/empty/loading/error/blocked */}
      <section className="compose__result">
        {phase === "idle" && <IdleResult samples={samples} />}
        {phase === "validation" && <BlockedResult validation={validation} />}
        {phase === "loading" && <LoadingResult stage={progressStage} photoCount={images.length} />}
        {phase === "result" && outcome && (
          <ResultView outcome={outcome} onSetOutcome={setOutcome} onReset={onReset}
            profile={profile ?? null} />
        )}
        {phase === "error" && (
          <ErrorView message={errorMessage ?? ""} onRetry={onSubmit} />
        )}
      </section>

      {/* FOOTER CTA */}
      <ComposeFooter
        phase={phase}
        storeName={storeName}
        length={length}
        tone={tone}
        missing={missing}
        photoCount={images.length}
        onSubmit={onSubmit}
        onReset={onReset}
        disabled={submitDisabled}
      />
    </div>
  );
}

// ============== Sub-views ==============

function ComposeFooter(props: {
  phase: Phase;
  storeName: string;
  length: number;
  tone: Tone;
  missing: number;
  photoCount: number;
  onSubmit: () => void;
  onReset: () => void;
  disabled: boolean;
}) {
  const { phase, storeName, length, tone, missing, onSubmit, onReset, disabled } = props;

  if (phase === "loading") {
    return (
      <footer className="compose__footer">
        <div className="compose__footer-info">
          <span className="status-dot status-dot--live"></span>
          <span className="status-text"><b>생성 중</b> · {storeName || "(미입력)"} · {length}자 · {toneLabel(tone)}</span>
        </div>
        <div className="compose__footer-meta"><span>진행 중</span></div>
        <button className="btn btn--secondary btn--lg" disabled>중단</button>
      </footer>
    );
  }

  if (phase === "validation" && missing > 0) {
    return (
      <footer className="compose__footer">
        <div className="compose__footer-info compose__footer-info--error">
          <span className="status-dot status-dot--danger"></span>
          <span className="status-text"><b>{missing}개 항목이 비어있어요</b> · 매장명, 주소, 메모 50자 이상</span>
        </div>
        <div className="compose__footer-meta"><span>필수 입력 {3 - missing}/3</span></div>
        <button className="btn btn--primary btn--lg" onClick={onSubmit}>
          글 만들기
          <IconArrow />
        </button>
      </footer>
    );
  }

  if (phase === "result") {
    return (
      <footer className="compose__footer">
        <div className="compose__footer-info">
          <span className="status-dot" style={{ background: "var(--success)", boxShadow: "0 0 0 3px var(--success-soft)" }}></span>
          <span className="status-text"><b>완료</b> · 히스토리에 저장됨</span>
        </div>
        <div className="compose__footer-meta"><span>새 글로 다시 시작할 수 있어요</span></div>
        <button className="btn btn--primary btn--lg" onClick={onReset}>
          새 글 쓰기
          <IconPlus />
        </button>
      </footer>
    );
  }

  if (phase === "error") {
    return (
      <footer className="compose__footer">
        <div className="compose__footer-info compose__footer-info--error">
          <span className="status-dot status-dot--danger"></span>
          <span className="status-text"><b>생성 실패</b> · 입력은 그대로 유지돼요</span>
        </div>
        <div className="compose__footer-meta"><span>다시 시도해보세요</span></div>
        <button className="btn btn--primary btn--lg" onClick={onSubmit} disabled={disabled}>
          다시 시도
          <IconRefresh />
        </button>
      </footer>
    );
  }

  return (
    <footer className="compose__footer">
      <div className="compose__footer-info">
        <span className="status-dot"></span>
        <span className="status-text">
          {missing > 0
            ? <>필수 항목을 채워주세요 · <b>매장명</b>, <b>주소</b>, <b>방문 메모</b></>
            : <>준비 완료 · 글 만들기 버튼을 눌러주세요</>}
        </span>
      </div>
      <div className="compose__footer-meta"><span>예상 소요: 약 25초</span></div>
      <button className="btn btn--primary btn--lg" onClick={onSubmit}
        aria-disabled={disabled} disabled={disabled}>
        글 만들기
        <IconArrow />
      </button>
    </footer>
  );
}

function toneLabel(t: Tone): string {
  return TONES.find((x) => x.value === t)?.label ?? t;
}

function IdleResult({ samples }: { samples: number }) {
  return (
    <div className="result-empty">
      <div className="result-empty__art" aria-hidden="true">
        <div className="art-card art-card--1">
          <div className="art-line" style={{ width: "60%" }}></div>
          <div className="art-line" style={{ width: "90%" }}></div>
          <div className="art-line" style={{ width: "75%" }}></div>
          <div className="art-marker"><span>사진1</span></div>
          <div className="art-line" style={{ width: "85%" }}></div>
          <div className="art-line" style={{ width: "50%" }}></div>
        </div>
        <div className="art-card art-card--2">
          <div className="art-tag">#한남동맛집</div>
          <div className="art-tag">#데이트</div>
          <div className="art-tag">#베트남음식</div>
        </div>
      </div>
      <h2 className="result-empty__title">왼쪽에 정보를 채우고<br />'글 만들기'를 눌러주세요</h2>
      <p className="result-empty__body">사진과 메모를 바탕으로 약 30초 안에<br />제목 · 본문 · 해시태그를 한 번에 만들어드려요.</p>
      <ul className="result-empty__tips">
        <li><span className="dot"></span>'내 스타일'은 {samples}개의 학습 글로 만들어졌어요</li>
        <li><span className="dot"></span>사진 순서가 본문 <code>[사진n]</code> 마커가 돼요</li>
        <li><span className="dot"></span>결과는 자동으로 히스토리에 저장돼요</li>
      </ul>
    </div>
  );
}

function BlockedResult({ validation }: { validation: MissingFields }) {
  const items: { n: number; label: string }[] = [];
  let n = 0;
  if (validation.storeName) items.push({ n: ++n, label: "매장명" });
  if (validation.address) items.push({ n: ++n, label: "매장 주소" });
  if (validation.memo.missing) items.push({ n: ++n, label: "방문 메모" });
  else if (validation.memo.short) items.push({ n: ++n, label: `방문 메모 (${MIN_MEMO_CHARS - validation.memo.chars}자 더)` });

  return (
    <div className="result-blocked">
      <div className="result-blocked__icon"><IconLock /></div>
      <div className="result-blocked__title">아직 만들 수 없어요</div>
      <p className="result-blocked__body">필수 항목 {items.length}개를 더 채우면<br />멋진 글이 나올 준비가 돼요.</p>
      <div className="result-blocked__missing">
        <div className="result-blocked__missing-title">남은 항목</div>
        <ul>
          {items.map((it) => (
            <li key={it.label}><span className="step__dot--err">{it.n}</span>{it.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const LOADING_STEPS = [
  { label: "사진 읽는 중", min: 0 },
  { label: "내 스타일 불러오는 중", min: 1 },
  { label: "제목과 본문 쓰는 중", min: 2 },
  { label: "해시태그 추출·마커 매칭", min: 3 },
];

function LoadingResult({ stage, photoCount }: { stage: string | null; photoCount: number }) {
  // Drive fake step progression based on time + actual stage strings.
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    setActiveIdx(0);
    const intervals = [3000, 6000, 9000];
    const timers = intervals.map((ms, i) =>
      setTimeout(() => setActiveIdx((prev) => Math.max(prev, i + 1)), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Bump if real stage hints at later step
  useEffect(() => {
    if (!stage) return;
    if (/완료|마무리|해시태그/.test(stage)) setActiveIdx((prev) => Math.max(prev, 3));
    else if (/작성|본문|생성/.test(stage)) setActiveIdx((prev) => Math.max(prev, 2));
  }, [stage]);

  return (
    <div className="loading">
      <div className="loading__visual">
        <div className="ring"></div>
        <div className="ring ring--2"></div>
        <div className="core">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </div>
      </div>

      <h2 className="loading__title">글을 만들고 있어요</h2>
      <p className="loading__sub">{stage ?? "잠시만 기다려주세요"} · 창을 닫아도 계속 진행돼요</p>

      <div className="steps">
        {LOADING_STEPS.map((s, i) => {
          const cls = i < activeIdx ? "done" : i === activeIdx ? "active" : "";
          return (
            <div className={`step ${cls}`} key={s.label}>
              <div className="step__dot">
                {i < activeIdx ? <IconCheck /> : i + 1}
              </div>
              <div className="step__label">
                {i === 0 && photoCount > 0 ? `사진 ${photoCount}장을 읽는 중` : s.label}
              </div>
              <div className="step__time">{i < activeIdx ? "✓" : i === activeIdx ? "…" : "—"}</div>
            </div>
          );
        })}
      </div>

      <div className="loading__tip">
        <IconInfo />
        사진이 많을수록 조금 더 걸려요. 평균 25–40초.
      </div>
    </div>
  );
}

function ResultView({
  outcome, onSetOutcome, onReset, profile,
}: {
  outcome: GenerateOutcome;
  onSetOutcome: (o: GenerateOutcome) => void;
  onReset: () => void;
  profile: StyleProfile | null;
}) {
  const r = outcome.result;
  const bodyChars = r.body.length;
  const copyBody = () => navigator.clipboard.writeText(r.body);
  const copyHashtags = () => navigator.clipboard.writeText(r.hashtags.map((h) => `#${h}`).join(" "));
  const copyMarkdown = () => {
    const md = `# ${r.title}\n\n${r.body}\n\n${r.hashtags.map((h) => `#${h}`).join(" ")}`;
    navigator.clipboard.writeText(md);
  };
  const copyStyled = async () => {
    const html = buildStyledHtml(r.body, profile);
    try {
      const ClipItem = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (typeof ClipItem === "function") {
        const blobHtml = new Blob([html], { type: "text/html" });
        const blobText = new Blob([r.body], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipItem({ "text/html": blobHtml, "text/plain": blobText }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
    } catch (e) {
      console.error("styled copy failed", e);
      await navigator.clipboard.writeText(r.body);
    }
  };
  const hasFormatting = Boolean(
    profile?.formatting && (
      profile.formatting.fontFamily ||
      profile.formatting.bodyFontSize ||
      profile.formatting.primaryColor ||
      profile.formatting.paragraphAlign
    ),
  );

  return (
    <div className="result">
      <header className="result__header">
        <span className="result__badge"><span className="dot"></span>생성 완료</span>
        <span className="result__meta">{bodyChars.toLocaleString()}자 · 자동 저장됨</span>
      </header>

      {outcome.warnings.length > 0 && (
        <div className="validation-banner" style={{ marginBottom: 16 }}>
          <div className="validation-banner__icon">!</div>
          <div className="validation-banner__body">
            <div className="validation-banner__title">주의</div>
            <ul className="validation-banner__list">
              {outcome.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* TITLE */}
      <div className="result__title-card">
        <div className="result__title-label">제목</div>
        <input className="result__title-input"
          value={r.title}
          onChange={(e) => onSetOutcome({ ...outcome, result: { ...r, title: e.target.value } })} />
      </div>

      {/* BODY */}
      <div className="result__body-card">
        <div className="result__section-title">
          본문
          <span className="btn-link">{bodyChars.toLocaleString()}자</span>
        </div>
        <textarea
          className="result__body"
          spellCheck={false}
          value={r.body}
          onChange={(e) => onSetOutcome({ ...outcome, result: { ...r, body: e.target.value } })}
          rows={20}
          style={{ width: "100%", border: "none", outline: "none", background: "transparent", resize: "vertical", fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit" }}
        />
      </div>

      {/* HASHTAGS */}
      <div className="result__hashtags">
        <div className="result__section-title">
          해시태그 · {r.hashtags.length}개
          <span className="btn-link" onClick={copyHashtags} style={{ cursor: "pointer" }}>
            <IconCopy />
            전체 복사
          </span>
        </div>
        <div className="hashtags">
          {r.hashtags.map((h) => (
            <span className="tag" key={h}
              onClick={() => navigator.clipboard.writeText(`#${h}`)}
              style={{ cursor: "pointer" }}>
              #{h}
            </span>
          ))}
        </div>
      </div>

      {/* PHOTO MAP */}
      {Object.keys(r.imageMap).length > 0 && (
        <div className="result__map">
          <div className="result__section-title">사진 매핑</div>
          <table className="map-table">
            <tbody>
              {Object.entries(r.imageMap).map(([marker, filename], i) => (
                <tr key={marker}>
                  <td>
                    <span className="marker-cell">
                      <span className="num">{i + 1}</span>
                      <span className="file">{filename}</span>
                    </span>
                  </td>
                  <td className="desc">{marker}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ACTIONS */}
      <div className="result__actions">
        <button className="btn btn--secondary" onClick={onReset}>
          <IconRefresh />
          처음부터 다시
        </button>
        <button className="btn btn--secondary" onClick={copyMarkdown}>
          <IconCopy />
          마크다운으로 복사
        </button>
        {hasFormatting && (
          <button className="btn btn--secondary" onClick={copyStyled}>
            <IconCopy />
            서식 포함 복사
          </button>
        )}
        <button className="btn btn--primary" onClick={copyBody}>
          <IconCopy />
          본문 복사
        </button>
      </div>
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const copyError = () => navigator.clipboard.writeText(message);
  return (
    <div className="compose-error">
      <div className="compose-error__icon"><IconAlert /></div>
      <h2 className="compose-error__title">글을 만들지 못했어요</h2>
      <p className="compose-error__sub">
        <b>오류가 발생했어요</b>. 잠시 후 다시 시도해주세요.<br />
        입력한 정보는 그대로 있어요.
      </p>

      <div className="compose-error__code">
        <div className="compose-error__code-row">
          <span className="k">message</span>
          <span className="v err">{message || "(메시지 없음)"}</span>
        </div>
      </div>

      <div className="compose-error__actions">
        <button className="btn btn--secondary" onClick={copyError}>
          <IconCopy />
          오류 메시지 복사
        </button>
        <button className="btn btn--primary" onClick={onRetry}>
          다시 시도
        </button>
      </div>

      <div className="compose-error__help">
        <div className="compose-error__help-title">자주 그런다면?</div>
        <ul>
          <li>설정 → AI 제공자에서 다른 모델로 바꿔보세요.</li>
          <li>사진을 5장 이하로 줄이면 요청 크기가 작아져 제한에 걸릴 확률이 낮아져요.</li>
          <li>API 키가 만료됐다면 설정에서 새 키로 갱신해주세요.</li>
        </ul>
      </div>
    </div>
  );
}
