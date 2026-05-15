import { useEffect, useState } from "react";
import { api } from "../api";
import type { HistoryRecord } from "@shared/types";

export default function History() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [open, setOpen] = useState<HistoryRecord | null>(null);

  const refresh = async () => setRecords(await api.history.list());
  useEffect(() => { void refresh(); }, []);

  const remove = async (id: string) => {
    await api.history.delete(id);
    if (open?.id === id) setOpen(null);
    await refresh();
  };

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      <section className="space-y-2 overflow-auto">
        <h1 className="text-2xl font-bold mb-2">히스토리</h1>
        {records.length === 0 && <div className="text-slate-500">아직 생성한 글이 없습니다.</div>}
        <ul className="divide-y border rounded">
          {records.map((r) => (
            <li key={r.id} className="p-3 hover:bg-slate-50 flex items-center justify-between">
              <button onClick={() => setOpen(r)} className="text-left">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-500">
                  {r.storeName} · {r.postType} · {new Date(r.createdAt).toLocaleString()}
                </div>
              </button>
              <button onClick={() => remove(r.id)} className="text-red-600 text-sm">삭제</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-l pl-6 overflow-auto">
        {!open && <div className="text-slate-500">왼쪽 목록에서 글을 선택하세요.</div>}
        {open && (
          <div className="space-y-3">
            <div className="text-xl font-bold">{open.title}</div>
            <div className="text-xs text-slate-500">{open.storeName} · {new Date(open.createdAt).toLocaleString()}</div>
            <pre className="whitespace-pre-wrap border rounded p-3 text-sm">{open.body}</pre>
            <div className="flex flex-wrap gap-1">
              {open.hashtags.map((h) => <span key={h} className="px-2 py-1 bg-slate-100 rounded text-sm">#{h}</span>)}
            </div>
            <button onClick={() => navigator.clipboard.writeText(open.body)}
              className="px-3 py-2 border rounded">본문 복사</button>
          </div>
        )}
      </section>
    </div>
  );
}
