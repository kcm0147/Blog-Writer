import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useCounts } from "../lib/counts";
import {
  IconChat, IconCircleInfo, IconEye, IconGrid, IconInfo, IconLock, IconSun,
} from "../lib/icons";
import type { Provider, SettingsWithKeyStatus } from "@shared/types";

type Tab = "ai" | "defaults" | "data" | "about";

export default function Settings() {
  const { refresh: refreshAppState } = useCounts();
  const [tab, setTab] = useState<Tab>("ai");
  const [s, setS] = useState<SettingsWithKeyStatus | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const next = await api.settings.get();
    if (!mountedRef.current) return;
    setS(next);
    await refreshAppState();
  }, [refreshAppState]);
  useEffect(() => { void refresh(); }, [refresh]);

  if (!s) {
    return (
      <div className="content scroll" style={{ padding: "var(--s-6)" }}>
        로딩 중…
      </div>
    );
  }

  return (
    <div className="content scroll" style={{ overflowY: "auto", maxHeight: "calc(100vh - var(--titlebar-h))" }}>
      <header className="set-hero">
        <h1 className="section-title">설정</h1>
        <p className="section-sub">API 키는 PC에만 저장돼요. 외부로 전송되지 않습니다.</p>
      </header>

      <div className="set-grid">
        <aside className="set-subnav">
          <SubnavLink active={tab === "ai"} onClick={() => setTab("ai")} icon={<IconSun />}>AI 연결</SubnavLink>
          <SubnavLink active={tab === "defaults"} onClick={() => setTab("defaults")} icon={<IconChat />}>글쓰기 기본값</SubnavLink>
          <SubnavLink active={tab === "data"} onClick={() => setTab("data")} icon={<IconGrid />}>데이터 관리</SubnavLink>
          <SubnavLink active={tab === "about"} onClick={() => setTab("about")} icon={<IconCircleInfo />}>앱 정보</SubnavLink>
        </aside>

        <div className="set-content">
          {tab === "ai" && <AITab s={s} refresh={refresh} />}
          {tab === "defaults" && <DefaultsTab s={s} refresh={refresh} />}
          {tab === "data" && <DataTab refresh={refresh} />}
          {tab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

function SubnavLink({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <a className={"set-subnav__item" + (active ? " is-active" : "")}
      onClick={onClick} style={{ cursor: "pointer" }}>
      <span className="icon">{icon}</span>
      {children}
    </a>
  );
}

// ============ AI tab ============

const CLAUDE_PRESETS = [
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "claude-haiku-4-5",
];
const GEMINI_PRESETS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
];

function AITab({ s, refresh }: { s: SettingsWithKeyStatus; refresh: () => Promise<void> }) {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validateState, setValidateState] = useState<{
    state: "idle" | "checking" | "ok" | "fail"; ms?: number; msg?: string;
  }>({ state: "idle" });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const onChangeProvider = async (p: Provider) => {
    await api.settings.setProvider(p);
    if (!mountedRef.current) return;
    setKeyInput("");
    setValidateState({ state: "idle" });
    await refresh();
  };

  const onSaveKey = async () => {
    if (!keyInput.trim()) return;
    await api.settings.setApiKey(s.provider, keyInput.trim());
    if (!mountedRef.current) return;
    setKeyInput("");
    setValidateState({ state: "idle" });
    await refresh();
  };

  const onClearKey = async () => {
    await api.settings.clearApiKey(s.provider);
    if (!mountedRef.current) return;
    setValidateState({ state: "idle" });
    await refresh();
  };

  const onValidate = async () => {
    setValidateState({ state: "checking" });
    const start = Date.now();
    try {
      const res = await api.settings.validateApiKey(s.provider);
      if (!mountedRef.current) return;
      const ms = Date.now() - start;
      setValidateState(res.ok
        ? { state: "ok", ms }
        : { state: "fail", ms, msg: res.message ?? "키가 유효하지 않아요" });
    } catch (e) {
      if (!mountedRef.current) return;
      setValidateState({ state: "fail", ms: Date.now() - start, msg: (e as Error).message });
    }
  };

  const setWebSearch = async (on: boolean) => {
    try { await api.settings.setWebSearch(on); } catch (e) { console.error(e); }
    if (!mountedRef.current) return;
    await refresh();
  };

  const onSelectModel = async (m: string) => {
    try { await api.settings.setModel(s.provider, m); } catch (e) { console.error(e); return; }
    if (!mountedRef.current) return;
    await refresh();
  };

  const hasKey = s.hasApiKey[s.provider];
  const maskedKey = s.apiKeyMasked[s.provider];
  const isError = validateState.state === "fail";

  return (
    <>
      {/* AI 제공자 */}
      <section className="set-card">
        <header className="set-card__head">
          <div>
            <h2 className="set-card__title">AI 제공자</h2>
            <p className="set-card__sub">글을 만들어줄 AI를 골라주세요. 언제든 바꿀 수 있어요.</p>
          </div>
        </header>

        <div className="provider-grid">
          <ProviderCard
            value="claude" name="Claude" sub="Anthropic · 한국어 문맥에 강한 편"
            badge="권장"
            selected={s.provider === "claude"}
            onClick={() => onChangeProvider("claude")} />
          <ProviderCard
            value="gemini" name="Gemini" sub="Google · 사진 인식이 빠른 편"
            selected={s.provider === "gemini"}
            onClick={() => onChangeProvider("gemini")} />
        </div>
      </section>

      {/* API 키 */}
      <section className="set-card">
        <header className="set-card__head">
          <div>
            <h2 className="set-card__title">API 키
              <span className="lock-icon" title="암호화 저장"><IconLock width={13} height={13} /></span>
            </h2>
            <p className="set-card__sub">키는 이 PC에만 저장돼요.</p>
          </div>
        </header>

        <div className="key-field">
          <div className={"key-field__input" + (isError ? " key-field__input--error" : "")}>
            <span className="key-field__prefix">{s.provider === "claude" ? "sk-ant-" : "AIza"}</span>
            <input type={showKey ? "text" : "password"}
              value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              placeholder={hasKey ? `(${maskedKey ?? "저장됨"} — 덮어쓰려면 입력)` : "API 키 입력"} />
            <button className="key-field__toggle" aria-label="키 보기"
              onClick={() => setShowKey((v) => !v)}>
              <IconEye />
            </button>
          </div>
          <button className="btn btn--secondary" onClick={onValidate}
            disabled={!hasKey || validateState.state === "checking"}>
            {validateState.state === "checking" ? "확인 중…" : "연결 확인"}
          </button>
        </div>

        <div className="result__actions" style={{ marginTop: "var(--s-2)", justifyContent: "flex-start" }}>
          <button className="btn btn--primary" onClick={onSaveKey} disabled={!keyInput.trim()}>저장</button>
          {hasKey && (
            <button className="btn btn--secondary" onClick={onClearKey}
              style={{ color: "var(--danger)" }}>키 삭제</button>
          )}
        </div>

        {validateState.state === "ok" && (
          <div className="key-status-box">
            <div className="dot"></div>
            <div className="text">
              <b>연결됨</b>
              <span>응답 정상</span>
            </div>
            <div className="key-status-box__meta">{validateState.ms}ms</div>
          </div>
        )}
        {validateState.state === "fail" && (
          <>
            <div className="key-status-box key-status-box--error">
              <div className="dot"></div>
              <div className="text">
                <b>연결 실패</b>
                <span>{validateState.msg ?? "키가 유효하지 않아요"}</span>
              </div>
              <div className="key-status-box__meta">{validateState.ms}ms</div>
            </div>

            <div className="err-help">
              <div className="err-help__title">확인해볼 점</div>
              <ol className="err-help__list">
                <li><b>키가 {s.provider === "claude" ? "sk-ant-" : "AIza"}로 시작하나요?</b></li>
                <li><b>앞뒤 공백이나 줄바꿈이 섞이지 않았을까요?</b> 전체를 선택해 다시 붙여넣어 보세요.</li>
                <li>{s.provider === "claude" ? "Anthropic Console" : "Google AI Studio"}에서 <b>새 키를 발급</b>해주세요.</li>
              </ol>
            </div>
          </>
        )}
        {validateState.state === "idle" && hasKey && (
          <div className="key-status-box">
            <div className="dot"></div>
            <div className="text">
              <b>키 저장됨</b>
              <span style={{ fontFamily: "var(--font-mono)" }}>{maskedKey}</span>
            </div>
            <div className="key-status-box__meta">'연결 확인'으로 테스트</div>
          </div>
        )}
        {!hasKey && (
          <div className="key-status-box key-status-box--error">
            <div className="dot"></div>
            <div className="text">
              <b>키가 없어요</b>
              <span>위 입력란에 키를 붙여넣고 '저장'을 눌러주세요</span>
            </div>
          </div>
        )}
      </section>

      {/* 모델 */}
      <section className="set-card">
        <header className="set-card__head">
          <div>
            <h2 className="set-card__title">모델</h2>
            <p className="set-card__sub">제공자별 사용할 모델을 선택해주세요.</p>
          </div>
        </header>

        <div className="field">
          <label className="label">{s.provider === "claude" ? "Claude" : "Gemini"} 모델</label>
          <div className="seg is-full">
            {(s.provider === "claude" ? CLAUDE_PRESETS : GEMINI_PRESETS).map((m) => (
              <button key={m}
                className={s.models[s.provider] === m ? "is-active" : ""}
                onClick={() => onSelectModel(m)}>{m}</button>
            ))}
          </div>
          <div className="helper" style={{ marginTop: "var(--s-2)" }}>
            현재: <b style={{ fontFamily: "var(--font-mono)" }}>{s.models[s.provider]}</b>
          </div>
        </div>
      </section>

      {/* 추가 옵션 */}
      <section className="set-card">
        <header className="set-card__head">
          <div>
            <h2 className="set-card__title">추가 옵션</h2>
          </div>
        </header>

        <div className="opt-row">
          <div className="opt-row__main">
            <div className="opt-row__title">웹 검색 사용</div>
            <div className="opt-row__sub">최신 매장 정보(영업시간, 메뉴 변경)를 자동으로 가져와요. 응답이 조금 더 걸릴 수 있어요.</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={s.useWebSearch}
              onChange={(e) => setWebSearch(e.target.checked)} />
            <span className="toggle__track"><span className="toggle__thumb"></span></span>
          </label>
        </div>
      </section>

      <div className="set-savebar">
        <div className="set-savebar__info">
          <IconInfo />
          변경사항은 자동으로 저장돼요.
        </div>
      </div>

      <div style={{ height: 48 }}></div>
    </>
  );
}

function ProviderCard({ value, name, sub, badge, selected, onClick }: {
  value: Provider; name: string; sub: string; badge?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <label className={"provider" + (selected ? " is-selected" : "")}>
      <input type="radio" name="provider" checked={selected} readOnly onClick={onClick} />
      <div className={`provider__logo provider__logo--${value}`}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div className="provider__body">
        <div className="provider__name">
          {name}
          {badge && <span className="provider__badge">{badge}</span>}
        </div>
        <div className="provider__sub">{sub}</div>
      </div>
      <div className="provider__check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </label>
  );
}

// ============ Defaults tab ============

function DefaultsTab({ s, refresh }: { s: SettingsWithKeyStatus; refresh: () => Promise<void> }) {
  const currentType = s.defaultPostType || "맛집";
  const currentLen = s.defaultLength || 1500;
  const currentTone = s.defaultTone || "my_style";

  const handleChange = async (newType: string, newLen: number, newTone: string) => {
    await api.settings.setDefaultValues(newType, newLen, newTone);
    await refresh();
  };

  return (
    <section className="set-card">
      <header className="set-card__head">
        <div>
          <h2 className="set-card__title">글쓰기 기본값</h2>
          <p className="set-card__sub">
            '새 글 작성'을 클릭했을 때 미리 세팅되어 있을 기본값을 설정합니다.
          </p>
        </div>
      </header>
      <div className="opt-row">
        <div className="opt-row__main">
          <div className="opt-row__title">기본 글 타입</div>
          <div className="opt-row__sub">선택된 카테고리의 템플릿과 키워드를 기준으로 글을 생성합니다.</div>
        </div>
        <div className="seg">
          {["맛집", "카페", "여행", "기타"].map(type => (
            <button key={type} className={currentType === type ? "is-active" : ""} onClick={() => handleChange(type, currentLen, currentTone)}>
              {type}{type !== "기타" ? " 후기" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="opt-row">
        <div className="opt-row__main">
          <div className="opt-row__title">기본 글자 수 (공백 제외)</div>
          <div className="opt-row__sub">1500자가 네이버 블로그 상위 노출에 가장 효과적이에요.</div>
        </div>
        <div className="seg">
          {[1500, 2000, 2500].map(len => (
            <button key={len} className={currentLen === len ? "is-active" : ""} onClick={() => handleChange(currentType, len, currentTone)}>
              {len}자
            </button>
          ))}
        </div>
      </div>

      <div className="opt-row">
        <div className="opt-row__main">
          <div className="opt-row__title">기본 말투</div>
          <div className="opt-row__sub">'내 스타일'은 '내가 쓴 글에서 추출한' 맞춤형 어투입니다.</div>
        </div>
        <div className="seg">
          <button className={currentTone === "my_style" ? "is-active" : ""} onClick={() => handleChange(currentType, currentLen, "my_style")}>내 스타일</button>
          <button className={currentTone === "해요" ? "is-active" : ""} onClick={() => handleChange(currentType, currentLen, "해요")}>해요체</button>
          <button className={currentTone === "합니다" ? "is-active" : ""} onClick={() => handleChange(currentType, currentLen, "합니다")}>합니다체</button>
          <button className={currentTone === "반말" ? "is-active" : ""} onClick={() => handleChange(currentType, currentLen, "반말")}>반말</button>
        </div>
      </div>
    </section>
  );
}

// ============ Data tab ============

function DataTab({ refresh }: { refresh: () => Promise<void> }) {
  const [dataDir, setDataDir] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    void api.settings.getDataDir().then((d) => {
      if (mountedRef.current) setDataDir(d);
    });
  }, []);

  const onChangeLocation = async () => {
    const picked = await api.dialog.pickFolder();
    if (!picked) return;
    if (picked === dataDir) return;
    const ok = window.confirm(
      `데이터를 다음 위치로 이동합니다.\n${picked}\n\n이동 후 변경사항을 반영하려면 앱을 다시 시작해주세요.`,
    );
    if (!ok) return;
    try {
      await api.settings.setDataDir(picked);
      if (!mountedRef.current) return;
      setDataDir(picked);
      await refresh();
      if (!mountedRef.current) return;
      window.alert("이동 완료. 앱을 다시 시작해주세요.");
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const onResetLocation = async () => {
    if (!window.confirm("데이터를 기본 위치로 되돌립니다. 진행할까요?")) return;
    try {
      await api.settings.setDataDir(null);
      if (!mountedRef.current) return;
      const next = await api.settings.getDataDir();
      if (!mountedRef.current) return;
      setDataDir(next);
      await refresh();
      if (!mountedRef.current) return;
      window.alert("기본 위치로 복귀. 앱을 다시 시작해주세요.");
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  return (
    <>
      <section className="set-card">
        <header className="set-card__head">
          <div>
            <h2 className="set-card__title">데이터 저장 위치</h2>
            <p className="set-card__sub">DB와 암호화된 API 키가 저장되는 폴더예요. 이동 후 앱을 재시작해주세요.</p>
          </div>
        </header>
        <div className="data-folder">
          <svg className="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <code style={{ fontFamily: "var(--font-mono)" }}>
            {dataDir ?? "로딩 중…"}
          </code>
        </div>
        <div className="result__actions" style={{ marginTop: "var(--s-3)", justifyContent: "flex-start" }}>
          <button className="btn btn--secondary" onClick={onChangeLocation}>변경</button>
          <button className="btn btn--secondary" onClick={onResetLocation}>기본값으로</button>
        </div>
      </section>

      <section className="set-card set-card--danger">
        <header className="set-card__head">
          <div>
            <h2 className="set-card__title set-card__title--danger">위험 영역</h2>
            <p className="set-card__sub">백업·내보내기 기능은 곧 추가될 예정이에요.</p>
          </div>
        </header>
        <div className="action-row">
          <div className="action-row__main">
            <div className="action-row__title">히스토리 전체 삭제</div>
            <div className="action-row__sub">히스토리 페이지에서 글을 개별로 삭제할 수 있어요.</div>
          </div>
          <button className="btn btn--danger" disabled>삭제</button>
        </div>
      </section>
    </>
  );
}

// ============ About tab ============

function AboutTab() {
  return (
    <>
      <section className="set-card about-hero">
        <div className="about-hero__mark">W</div>
        <div className="about-hero__body">
          <h2 className="about-hero__name">Writelet</h2>
          <p className="about-hero__tag">내가 쓴 글의 말투로, 한 편 더 — 네이버 블로그 자동 작성기</p>
          <div className="about-hero__meta">
            <span className="about-hero__version">v0.1.0</span>
            <span className="about-hero__channel">dev</span>
          </div>
        </div>
      </section>

      <section className="set-card">
        <header className="set-card__head">
          <div>
            <h2 className="set-card__title">개인정보</h2>
            <p className="set-card__sub">사용자 PC에서만 동작합니다.</p>
          </div>
        </header>
        <p style={{ color: "var(--text-2)", margin: 0 }}>
          API 키, 학습 글, 생성된 글, 사진은 모두 이 PC에만 저장됩니다.<br />
          AI 호출 시에는 입력하신 매장 정보·사진·메모만 선택한 AI 제공자(Claude/Gemini)로 전송돼요.
        </p>
      </section>

      <div className="about-foot">
        <span>© 2026 Writelet</span>
        <span className="sep">·</span>
        <span>사용자 PC에서만 동작합니다</span>
      </div>
    </>
  );
}
