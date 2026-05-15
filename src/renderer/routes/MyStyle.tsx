import { useEffect, useState } from "react";
import { api } from "../api";
import type { Sample, StyleProfile } from "@shared/types";

export default function MyStyle() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const refresh = async () => {
    setSamples(await api.samples.list());
    setProfile(await api.style.getProfile());
  };
  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const off1 = api.style.onProgress(setProgress);
    const off2 = api.style.onWarning((w) => setWarnings((prev) => [...prev, w]));
    return () => { off1(); off2(); };
  }, []);

  const add = async () => {
    if (!body.trim()) return;
    await api.samples.add({ label: label.trim() || "(이름 없음)", body });
    setLabel(""); setBody("");
    await refresh();
  };

  const remove = async (id: string) => {
    await api.samples.delete(id);
    await refresh();
  };

  const analyze = async () => {
    setAnalyzing(true); setWarnings([]); setProgress("시작");
    try {
      await api.style.analyze();
      await refresh();
    } catch (e) {
      setWarnings([(e as Error).message]);
    } finally {
      setAnalyzing(false); setProgress(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">내 스타일</h1>

      <section className="border rounded p-4 space-y-2">
        <div className="font-medium">새 글 추가</div>
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="라벨 (예: 성수동 카페 후기)"
          className="w-full border rounded px-3 py-2" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          rows={8} placeholder="블로그 글 본문을 붙여넣어주세요"
          className="w-full border rounded px-3 py-2" />
        <button onClick={add} className="px-3 py-2 bg-blue-600 text-white rounded">저장</button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">등록된 글 ({samples.length})</div>
          <button onClick={analyze} disabled={analyzing || samples.length === 0}
            className="px-3 py-2 bg-slate-900 text-white rounded disabled:opacity-50">
            {analyzing ? "분석 중…" : "스타일 분석 시작"}
          </button>
        </div>
        {progress && <div className="text-sm text-slate-500 mb-2">{progress}</div>}
        {warnings.length > 0 && (
          <div className="border border-amber-300 bg-amber-50 rounded p-2 text-sm space-y-1 mb-2">
            {warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
          </div>
        )}
        <ul className="divide-y border rounded">
          {samples.map((s) => (
            <li key={s.id} className="flex items-center justify-between p-2">
              <div>
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-slate-500">{s.charCount}자 · {new Date(s.createdAt).toLocaleString()}</div>
              </div>
              <button onClick={() => remove(s.id)} className="text-red-600 text-sm">삭제</button>
            </li>
          ))}
        </ul>
      </section>

      {profile && (
        <section className="border rounded p-4 space-y-1 text-sm">
          <div className="font-medium text-base mb-2">분석된 스타일 프로파일</div>
          <div>샘플 수: {profile.sampleCount}</div>
          <div>말투 비율: {Object.entries(profile.toneDistribution).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(", ")}</div>
          <div>평균 문장 길이: {profile.avgSentenceLength}자</div>
          <div>자주 쓰는 표현: {profile.commonExpressions.join(", ")}</div>
          <div>이모지 빈도: {profile.emojiFrequency}</div>
          <div>구조: {profile.structureNotes}</div>
          <div>사진 묘사: {profile.photoDescriptionStyle}</div>
        </section>
      )}
    </div>
  );
}
