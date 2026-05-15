import { Link, Outlet, useLocation } from "react-router-dom";

const NAV = [
  { to: "/", label: "✍️ 글 작성" },
  { to: "/style", label: "📚 내 스타일" },
  { to: "/history", label: "🕓 히스토리" },
  { to: "/settings", label: "⚙️ 설정" },
];

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="h-full flex">
      <aside className="w-56 bg-slate-50 border-r p-4 flex flex-col gap-2">
        <div className="text-lg font-bold mb-4 px-2">네이버 블로그 작성기</div>
        {NAV.map((n) => (
          <Link key={n.to} to={n.to}
            className={`px-3 py-2 rounded text-sm ${
              loc.pathname === n.to ? "bg-slate-200 font-medium" : "hover:bg-slate-100"
            }`}>
            {n.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
