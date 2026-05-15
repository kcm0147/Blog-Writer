import { useEffect, useState } from "react";
import { api } from "../api";
import type { Provider, SettingsWithKeyStatus } from "@shared/types";

export default function Settings() {
  const [s, setS] = useState<SettingsWithKeyStatus | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [validateMsg, setValidateMsg] = useState<string | null>(null);

  const refresh = async () => setS(await api.settings.get());
  useEffect(() => { void refresh(); }, []);

  if (!s) return <div>로딩 중…</div>;

  const onChangeProvider = async (p: Provider) => {
    await api.settings.setProvider(p);
    await refresh();
    setKeyInput("");
    setValidateMsg(null);
  };

  const onSaveKey = async () => {
    if (!keyInput.trim()) return;
    await api.settings.setApiKey(s.provider, keyInput.trim());
    setKeyInput("");
    setValidateMsg(null);
    await refresh();
  };

  const onClearKey = async () => {
    await api.settings.clearApiKey(s.provider);
    setValidateMsg(null);
    await refresh();
  };

  const onValidate = async () => {
    setValidateMsg("확인 중…");
    const ok = await api.settings.validateApiKey(s.provider);
    setValidateMsg(ok ? "✅ 정상" : "❌ 키가 유효하지 않습니다.");
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <section className="space-y-2">
        <div className="font-medium">LLM 제공자</div>
        <div className="flex gap-2">
          {(["claude", "gemini"] as Provider[]).map((p) => (
            <button key={p} onClick={() => onChangeProvider(p)}
              className={`px-4 py-2 rounded border ${
                s.provider === p ? "bg-slate-900 text-white" : "bg-white"
              }`}>
              {p === "claude" ? "Claude" : "Gemini"}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="font-medium">
          API 키 ({s.provider})
          {s.hasApiKey[s.provider] && <span className="ml-2 text-green-700 text-sm">저장됨</span>}
        </div>
        <input
          type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
          placeholder={s.hasApiKey[s.provider] ? "새 키로 덮어쓰려면 입력" : "API 키를 입력하세요"}
          className="w-full border rounded px-3 py-2"
        />
        <div className="flex gap-2">
          <button onClick={onSaveKey} className="px-3 py-2 bg-blue-600 text-white rounded">저장</button>
          <button onClick={onValidate} disabled={!s.hasApiKey[s.provider]}
            className="px-3 py-2 border rounded disabled:opacity-50">연결 확인</button>
          {s.hasApiKey[s.provider] && (
            <button onClick={onClearKey} className="px-3 py-2 border rounded text-red-600">키 삭제</button>
          )}
        </div>
        {validateMsg && <div className="text-sm">{validateMsg}</div>}
      </section>

      <section className="space-y-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.useWebSearch}
            onChange={async (e) => {
              try {
                await api.settings.setWebSearch(e.target.checked);
              } catch (err) {
                console.error("setWebSearch failed", err);
              }
              await refresh();
            }} />
          <span>웹 검색 사용 (최신 매장 정보 자동 조회)</span>
        </label>
      </section>
    </div>
  );
}
