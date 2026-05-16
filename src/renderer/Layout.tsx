import { Link, Outlet, useLocation } from "react-router-dom";
import {
  IconCompose, IconBook, IconHistory, IconSettings,
} from "./lib/icons";
import { useCounts } from "./lib/counts";
import type { Provider } from "@shared/types";

interface TitlebarSpec {
  crumbs: React.ReactNode;
  active: "compose" | "style" | "history" | "settings";
}

function titlebarFor(pathname: string): TitlebarSpec {
  if (pathname.startsWith("/style")) {
    return { crumbs: <>내 스타일 / <b>분석 결과</b></>, active: "style" };
  }
  if (pathname.startsWith("/history")) {
    return { crumbs: <>히스토리 / <b>전체</b></>, active: "history" };
  }
  if (pathname.startsWith("/settings")) {
    return { crumbs: <>설정 / <b>AI 연결</b></>, active: "settings" };
  }
  return { crumbs: <>글 작성 / <b>새 글</b></>, active: "compose" };
}

function providerLabel(p: Provider) {
  return p === "claude" ? "Claude" : "Gemini";
}

export default function Layout() {
  const loc = useLocation();
  const { samples, history, settings } = useCounts();
  const { active, crumbs } = titlebarFor(loc.pathname);

  const hasKey = settings ? settings.hasApiKey[settings.provider] : false;
  const providerName = settings ? providerLabel(settings.provider) : null;
  const statusText = settings
    ? `${providerName} · ${hasKey ? "API 연결됨" : "키 없음"}`
    : "연결 안 됨";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <div className="brand-name">Writelet</div>
            <div className="brand-sub">내 스타일로 쓰는 블로그</div>
          </div>
        </div>

        <nav className="nav">
          <Link className={"nav-item" + (active === "compose" ? " is-active" : "")} to="/">
            <span className="icon"><IconCompose /></span>
            글 작성
          </Link>
          <Link className={"nav-item" + (active === "style" ? " is-active" : "")} to="/style">
            <span className="icon"><IconBook /></span>
            내 스타일
            <span className="count">{samples}</span>
          </Link>
          <Link className={"nav-item" + (active === "history" ? " is-active" : "")} to="/history">
            <span className="icon"><IconHistory /></span>
            히스토리
            <span className="count">{history}</span>
          </Link>
        </nav>

        <div className="nav-section">설정</div>
        <Link className={"nav-item" + (active === "settings" ? " is-active" : "")} to="/settings">
          <span className="icon"><IconSettings /></span>
          설정
        </Link>

        <div className="footer">
          <div className={"key-dot" + (hasKey ? "" : " key-dot--err")}></div>
          <div className="key-status">
            <span>{statusText}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="main-titlebar">
          <div className="crumbs">{crumbs}</div>
          <div className="actions" id="titlebar-actions" />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
