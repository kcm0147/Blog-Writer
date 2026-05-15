import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { fileToImageInput } from "../lib/readImage";
import type {
  GenerateInput, ImageInput, PostType, StyleProfile, Tone,
} from "@shared/types";
import type { GenerateOutcome } from "@shared/api";

const POST_TYPES: PostType[] = ["맛집", "카페", "여행", "기타"];
const TONES: Array<{ value: Tone; label: string }> = [
  { value: "my_style", label: "내 스타일" },
  { value: "해요", label: "해요" },
  { value: "합니다", label: "합니다" },
  { value: "반말", label: "반말" },
];
const LENGTHS = [500, 1000, 1500, 2000];

export default function Compose() {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [postType, setPostType] = useState<PostType>("맛집");
  const [title, setTitle] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [length, setLength] = useState(1500);
  const [tone, setTone] = useState<Tone>("my_style");
  const [emphasis, setEmphasis] = useState("");
  const [memo, setMemo] = useState("");
  const [images, setImages] = useState<ImageInput[]>([]);

  const [outcome, setOutcome] = useState<GenerateOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void api.style.getProfile().then(setProfile); }, []);
  useEffect(() => {
    const off = api.generate.onProgress(setProgress);
    return () => off();
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const inputs: ImageInput[] = [];
    const remaining = 10 - images.length;
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const f = files[i];
      if (f) inputs.push(await fileToImageInput(f));
    }
    setImages((prev) => [...prev, ...inputs].slice(0, 10));
  };

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, j) => j !== i));
  };

  const canSubmit =
    !!profile &&
    storeName.trim().length > 0 &&
    address.trim().length > 0 &&
    !running;

  const submit = async () => {
    setError(null); setRunning(true); setOutcome(null);
    const input: GenerateInput = {
      info: {
        storeName: storeName.trim(),
        address: address.trim(),
        visitDate: visitDate || undefined,
        postType,
        title: title.trim() || undefined,
        keywords: keywordsInput.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5),
        length,
        tone,
        emphasis: emphasis.trim(),
      },
      memo: memo.trim(),
      images,
      useWebSearch: false,
    };
    try {
      setOutcome(await api.generate.run(input));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false); setProgress(null);
    }
  };

  if (!profile) {
    return (
      <div>
        <p className="mb-2">스타일 프로파일이 아직 없습니다.</p>
        <Link to="/style" className="text-blue-600 underline">
          내 스타일에서 글을 등록하고 분석을 먼저 진행해주세요.
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      <section className="space-y-3 overflow-auto pr-2">
        <h1 className="text-2xl font-bold">글 작성</h1>

        <Field label="글 타입">
          <select value={postType} onChange={(e) => setPostType(e.target.value as PostType)}
            className="border rounded px-3 py-2 w-full">
            {POST_TYPES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="매장명 *"><Input value={storeName} onChange={setStoreName} /></Field>
        <Field label="매장 주소 *"><Input value={address} onChange={setAddress} /></Field>
        <Field label="방문일">
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)}
            className="border rounded px-3 py-2 w-full" />
        </Field>
        <Field label="글 제목 (비우면 AI가 제안)"><Input value={title} onChange={setTitle} /></Field>
        <Field label="SEO 키워드 (쉼표 구분, 최대 5개)">
          <Input value={keywordsInput} onChange={setKeywordsInput} />
        </Field>

        <Field label="사진 (최대 10장)">
          <input type="file" accept=".jpg,.jpeg,.png" multiple
            onChange={(e) => onFiles(e.target.files)} />
          {images.length > 0 && (
            <div className="grid grid-cols-5 gap-2 mt-2">
              {images.map((img, i) => (
                <div key={i} className="relative border rounded p-1 text-xs">
                  <div className="font-medium">[사진{i + 1}]</div>
                  <div className="truncate">{img.filename}</div>
                  <button onClick={() => removeImage(i)}
                    className="absolute top-0 right-1 text-red-600">×</button>
                </div>
              ))}
            </div>
          )}
        </Field>

        <Field label="글자수">
          <div className="flex gap-2">
            {LENGTHS.map((n) => (
              <button key={n} onClick={() => setLength(n)}
                className={`px-3 py-2 rounded border ${
                  length === n ? "bg-slate-900 text-white" : ""
                }`}>{n}자</button>
            ))}
          </div>
        </Field>

        <Field label="말투">
          <div className="flex gap-2">
            {TONES.map((t) => (
              <button key={t.value} onClick={() => setTone(t.value)}
                className={`px-3 py-2 rounded border ${
                  tone === t.value ? "bg-slate-900 text-white" : ""
                }`}>{t.label}</button>
            ))}
          </div>
        </Field>

        <Field label="강조 / 제외 사항">
          <textarea value={emphasis} onChange={(e) => setEmphasis(e.target.value)}
            rows={3} className="w-full border rounded px-3 py-2"
            placeholder="예: 친구랑 오후 2시 방문. 직접 결제했다는 표현은 빼줘." />
        </Field>

        <Field label="방문 메모">
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
            rows={6} className="w-full border rounded px-3 py-2"
            placeholder="이번 방문의 키워드, 감상, 디테일을 자유롭게 적어주세요." />
        </Field>

        <button onClick={submit} disabled={!canSubmit}
          className="w-full py-3 bg-blue-600 text-white rounded font-medium disabled:opacity-50">
          {running ? `생성 중… ${progress ?? ""}` : "글 만들기"}
        </button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </section>

      <section className="border-l pl-6 overflow-auto">
        <h2 className="text-xl font-bold mb-3">결과</h2>
        {!outcome && !running && (
          <div className="text-slate-500">왼쪽에 정보를 채우고 '글 만들기'를 눌러주세요.</div>
        )}
        {running && <div className="text-slate-500">{progress ?? "준비 중…"}</div>}
        {outcome && (
          <div className="space-y-4">
            {outcome.warnings.length > 0 && (
              <div className="border border-amber-300 bg-amber-50 rounded p-2 text-sm space-y-1">
                {outcome.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
              </div>
            )}
            <div>
              <div className="text-xs uppercase text-slate-500">제목</div>
              <input value={outcome.result.title}
                onChange={(e) => setOutcome({ ...outcome, result: { ...outcome.result, title: e.target.value } })}
                className="w-full text-xl font-bold border-b py-1" />
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">본문</div>
              <textarea value={outcome.result.body}
                onChange={(e) => setOutcome({ ...outcome, result: { ...outcome.result, body: e.target.value } })}
                rows={20} className="w-full border rounded p-2 font-mono text-sm" />
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">사진 매핑</div>
              <ul className="text-sm">
                {Object.entries(outcome.result.imageMap).map(([k, v]) => (
                  <li key={k}>[{k}] = {v}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">해시태그</div>
              <div className="flex flex-wrap gap-1">
                {outcome.result.hashtags.map((h) => (
                  <span key={h} className="px-2 py-1 bg-slate-100 rounded text-sm">#{h}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(outcome.result.body)}
                className="px-3 py-2 border rounded">본문 복사</button>
              <button onClick={() => navigator.clipboard.writeText(outcome.result.hashtags.map((h) => `#${h}`).join(" "))}
                className="px-3 py-2 border rounded">해시태그 복사</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded px-3 py-2" />
  );
}
