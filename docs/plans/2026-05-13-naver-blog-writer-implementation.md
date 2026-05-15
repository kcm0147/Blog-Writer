# naver-blog-writer 구현 계획 v3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Electron 데스크탑 앱(Mac+Windows)으로 빌드되는 네이버 블로그 자동 작성기. 사용자가 자신의 Claude 또는 Gemini API 키를 입력하여 동작.

**Architecture:** Electron 3-프로세스 구조 (main / preload / renderer). 모든 LLM 호출과 영속 데이터는 main에서, UI는 React 렌더러에서. IPC는 typed contextBridge로 연결.

**Tech Stack:** Electron, TypeScript 5, React 18 + Vite (electron-vite), Tailwind, @anthropic-ai/sdk, @google/generative-ai, better-sqlite3, electron-store, electron.safeStorage, sharp, vitest, electron-builder.

**Related docs:**
- Spec: `docs/specs/2026-05-13-naver-blog-writer-design.md`
- Designer brief: `docs/design-brief.md` (디자이너 산출물은 `design/` 폴더에 도착 예정)

---

## Phase 0 — 부트스트랩

### Task 1: electron-vite 프로젝트 초기화

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.gitignore`, `.eslintrc.cjs`, `vitest.config.ts`

- [ ] **Step 1: working directory 확인 + 기존 파일 정리**

```bash
cd /Users/mook/project/naver-blog-writer
# 이전 Python 자산이 있다면 삭제 — docs/ 는 유지
ls
```

- [ ] **Step 2: package.json 생성**

```json
{
  "name": "naver-blog-writer",
  "version": "0.1.0",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "build:mac": "electron-vite build && electron-builder --mac",
    "build:win": "electron-vite build && electron-builder --win",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    "@google/generative-ai": "^0.21.0",
    "better-sqlite3": "^11.5.0",
    "electron-store": "^10.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.27.0",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "electron-vite": "^2.3.0",
    "happy-dom": "^15.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["electron.vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 5: electron.vite.config.ts**

```ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": resolve("src/shared"), "@main": resolve("src/main") } },
    build: { rollupOptions: { input: resolve("src/main/index.ts") } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": resolve("src/shared") } },
    build: { rollupOptions: { input: resolve("src/preload/index.ts") } },
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: { "@shared": resolve("src/shared"), "@renderer": resolve("src/renderer") } },
    build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
  },
});
```

- [ ] **Step 6: vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@shared": resolve("src/shared"),
      "@main": resolve("src/main"),
      "@renderer": resolve("src/renderer"),
    },
  },
});
```

- [ ] **Step 7: tests/setup.ts**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 8: .gitignore**

```
node_modules/
out/
release/
dist/
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 9: 설치 + 타입 확인**

```bash
npm install
npm run typecheck
```

Expected: 설치 완료, typecheck는 src/ 가 비어있어 통과 (또는 "no inputs" warning).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: bootstrap electron-vite + react + ts project"
```

---

### Task 2: Tailwind 설정 + 최소 윈도우 표시

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`
- Create: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/styles/index.css`
- Create: `src/shared/types.ts` (스텁)

- [ ] **Step 1: tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 2: postcss.config.js**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 3: `src/renderer/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", sans-serif; }
```

- [ ] **Step 4: `src/renderer/index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>네이버 블로그 작성기</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: `src/renderer/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 6: `src/renderer/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="h-full flex items-center justify-center text-2xl text-slate-700">
      naver-blog-writer 부팅 완료
    </div>
  );
}
```

- [ ] **Step 7: `src/preload/index.ts` (스텁)**

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("api", {});
```

- [ ] **Step 8: `src/main/index.ts`**

```ts
import { app, BrowserWindow } from "electron";
import { join } from "path";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 9: `src/shared/types.ts` (스텁, Phase별로 확장)**

```ts
export type Provider = "claude" | "gemini";
```

- [ ] **Step 10: 실행 확인**

```bash
npm run dev
```
Expected: Electron 창이 뜨고 "naver-blog-writer 부팅 완료" 표시. 창 닫음.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: minimal electron window with react renderer"
```

---

## Phase 1 — 공유 타입 + 스토리지

### Task 3: 공유 타입 정의

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: 타입 작성**

```ts
export type Provider = "claude" | "gemini";

export type PostType = "맛집" | "카페" | "여행" | "기타";
export type Tone = "my_style" | "해요" | "합니다" | "반말";

export interface Sample {
  id: string;
  label: string;
  body: string;
  charCount: number;
  createdAt: string;
}

export interface StyleProfile {
  toneDistribution: Record<string, number>;
  avgSentenceLength: number;
  commonExpressions: string[];
  emojiFrequency: "none" | "low" | "medium" | "high";
  structureNotes: string;
  photoDescriptionStyle: string;
  sourceHash: string;
  sampleCount: number;
  updatedAt: string;
}

export type StyleProfileCore = Omit<
  StyleProfile,
  "sourceHash" | "sampleCount" | "updatedAt"
>;

export interface StoreInfo {
  storeName: string;
  address: string;
  visitDate?: string;
  postType: PostType;
  title?: string;
  keywords: string[];
  length: number;
  tone: Tone;
  emphasis: string;
}

export interface ImageInput {
  filename: string;
  mediaType: "image/jpeg" | "image/png";
  base64: string;
}

export interface GenerateInput {
  info: StoreInfo;
  memo: string;
  images: ImageInput[];
  useWebSearch: boolean;
}

export interface GenerationResult {
  title: string;
  body: string;
  hashtags: string[];
  imageMap: Record<string, string>;
}

export interface HistoryRecord extends GenerationResult {
  id: string;
  storeName: string;
  address?: string;
  postType: PostType;
  createdAt: string;
}

export interface Settings {
  provider: Provider;
  useWebSearch: boolean;
}

export interface SettingsWithKeyStatus extends Settings {
  hasApiKey: Record<Provider, boolean>;
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(shared): define shared types"
```

---

### Task 4: SQLite 초기화 + 마이그레이션

**Files:**
- Create: `src/main/storage/db.ts`
- Test: `tests/main/storage/db.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/main/storage/db.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { openDatabase } from "@main/storage/db";

describe("openDatabase", () => {
  it("creates required tables", () => {
    const db = openDatabase(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("samples");
    expect(names).toContain("style_profile");
    expect(names).toContain("generations");
    db.close();
  });

  it("is idempotent — second open does not error", () => {
    const db1 = openDatabase(":memory:");
    db1.close();
    const db2 = openDatabase(":memory:");
    db2.close();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- tests/main/storage/db.test.ts
```
Expected: cannot import `@main/storage/db`.

- [ ] **Step 3: 구현**

`src/main/storage/db.ts`:

```ts
import Database, { Database as DB } from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS style_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  address TEXT,
  post_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hashtags TEXT NOT NULL,
  image_map TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function openDatabase(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/main/storage/db.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/main/storage/db.ts tests/main/storage/db.test.ts
git commit -m "feat(storage): sqlite schema + open helper"
```

---

### Task 5: 샘플 CRUD

**Files:**
- Create: `src/main/storage/samples.ts`
- Test: `tests/main/storage/samples.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/main/storage/samples.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "@main/storage/db";
import { addSample, listSamples, deleteSample, getAllBodies } from "@main/storage/samples";

let db: Database;
beforeEach(() => {
  db = openDatabase(":memory:");
});

describe("samples", () => {
  it("add then list returns the sample", () => {
    const s = addSample(db, { label: "테스트", body: "본문" });
    expect(s.label).toBe("테스트");
    expect(s.charCount).toBe(2);
    const all = listSamples(db);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(s.id);
  });

  it("list returns samples newest-first", () => {
    addSample(db, { label: "A", body: "a" });
    addSample(db, { label: "B", body: "b" });
    const all = listSamples(db);
    expect(all.map((s) => s.label)).toEqual(["B", "A"]);
  });

  it("delete removes the sample", () => {
    const s = addSample(db, { label: "X", body: "x" });
    deleteSample(db, s.id);
    expect(listSamples(db)).toHaveLength(0);
  });

  it("getAllBodies returns just body text in stable order", () => {
    addSample(db, { label: "A", body: "글A" });
    addSample(db, { label: "B", body: "글B" });
    const bodies = getAllBodies(db);
    expect(bodies).toHaveLength(2);
    expect(bodies).toContain("글A");
    expect(bodies).toContain("글B");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npm test -- tests/main/storage/samples.test.ts
```

- [ ] **Step 3: 구현**

`src/main/storage/samples.ts`:

```ts
import type { Database } from "better-sqlite3";
import { randomUUID } from "crypto";
import type { Sample } from "@shared/types";

interface Row {
  id: string;
  label: string;
  body: string;
  char_count: number;
  created_at: string;
}

const toSample = (r: Row): Sample => ({
  id: r.id,
  label: r.label,
  body: r.body,
  charCount: r.char_count,
  createdAt: r.created_at,
});

export function addSample(
  db: Database,
  { label, body }: { label: string; body: string },
): Sample {
  const id = randomUUID().slice(0, 12);
  const charCount = body.length;
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO samples (id, label, body, char_count, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, label, body, charCount, createdAt);
  return { id, label, body, charCount, createdAt };
}

export function listSamples(db: Database): Sample[] {
  const rows = db
    .prepare("SELECT * FROM samples ORDER BY created_at DESC")
    .all() as Row[];
  return rows.map(toSample);
}

export function deleteSample(db: Database, id: string): void {
  db.prepare("DELETE FROM samples WHERE id = ?").run(id);
}

export function getAllBodies(db: Database): string[] {
  const rows = db
    .prepare("SELECT body FROM samples ORDER BY id ASC")
    .all() as { body: string }[];
  return rows.map((r) => r.body);
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/storage/samples.test.ts
git add src/main/storage/samples.ts tests/main/storage/samples.test.ts
git commit -m "feat(storage): samples CRUD"
```

---

### Task 6: 스타일 프로파일 캐시 (해시 기반)

**Files:**
- Create: `src/main/storage/styleProfile.ts`
- Test: `tests/main/storage/styleProfile.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/main/storage/styleProfile.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "@main/storage/db";
import { addSample } from "@main/storage/samples";
import {
  computeSamplesHash,
  saveProfile,
  loadProfile,
  loadProfileIfFresh,
} from "@main/storage/styleProfile";
import type { StyleProfileCore } from "@shared/types";

const CORE: StyleProfileCore = {
  toneDistribution: { 해요: 1.0 },
  avgSentenceLength: 30,
  commonExpressions: ["진짜"],
  emojiFrequency: "low",
  structureNotes: "도입-본문-마무리",
  photoDescriptionStyle: "감성",
};

let db: Database;
beforeEach(() => {
  db = openDatabase(":memory:");
});

describe("styleProfile", () => {
  it("computeSamplesHash changes with content", () => {
    addSample(db, { label: "a", body: "글1" });
    const h1 = computeSamplesHash(db);
    addSample(db, { label: "b", body: "글2" });
    const h2 = computeSamplesHash(db);
    expect(h1).not.toBe(h2);
  });

  it("save then load returns the profile", () => {
    addSample(db, { label: "a", body: "글1" });
    const saved = saveProfile(db, CORE);
    const loaded = loadProfile(db);
    expect(loaded).not.toBeNull();
    expect(loaded!.sourceHash).toBe(saved.sourceHash);
    expect(loaded!.commonExpressions).toEqual(["진짜"]);
  });

  it("loadProfileIfFresh returns null after samples change", () => {
    addSample(db, { label: "a", body: "글1" });
    saveProfile(db, CORE);
    addSample(db, { label: "b", body: "추가" });
    expect(loadProfileIfFresh(db)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/storage/styleProfile.ts`:

```ts
import type { Database } from "better-sqlite3";
import { createHash } from "crypto";
import type { StyleProfile, StyleProfileCore } from "@shared/types";

export function computeSamplesHash(db: Database): string {
  const rows = db
    .prepare("SELECT id, body FROM samples ORDER BY id ASC")
    .all() as { id: string; body: string }[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(r.id);
    h.update("\0");
    h.update(r.body);
    h.update("\0");
  }
  return h.digest("hex");
}

export function saveProfile(db: Database, core: StyleProfileCore): StyleProfile {
  const sourceHash = computeSamplesHash(db);
  const sampleCount = (
    db.prepare("SELECT COUNT(*) as c FROM samples").get() as { c: number }
  ).c;
  const updatedAt = new Date().toISOString();
  const profile: StyleProfile = { ...core, sourceHash, sampleCount, updatedAt };
  db.prepare(
    `INSERT INTO style_profile (id, json, source_hash, sample_count, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET json=excluded.json, source_hash=excluded.source_hash,
       sample_count=excluded.sample_count, updated_at=excluded.updated_at`,
  ).run(JSON.stringify(profile), sourceHash, sampleCount, updatedAt);
  return profile;
}

export function loadProfile(db: Database): StyleProfile | null {
  const row = db
    .prepare("SELECT json FROM style_profile WHERE id = 1")
    .get() as { json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.json) as StyleProfile;
}

export function loadProfileIfFresh(db: Database): StyleProfile | null {
  const profile = loadProfile(db);
  if (!profile) return null;
  if (profile.sourceHash !== computeSamplesHash(db)) return null;
  return profile;
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/storage/styleProfile.test.ts
git add src/main/storage/styleProfile.ts tests/main/storage/styleProfile.test.ts
git commit -m "feat(storage): style profile with hash-based cache"
```

---

### Task 7: 히스토리 CRUD

**Files:**
- Create: `src/main/storage/history.ts`
- Test: `tests/main/storage/history.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "@main/storage/db";
import { saveGeneration, listHistory, getHistory, deleteHistory } from "@main/storage/history";

let db: Database;
beforeEach(() => {
  db = openDatabase(":memory:");
});

describe("history", () => {
  it("save + get round-trip", () => {
    const rec = saveGeneration(db, {
      storeName: "X카페", address: "서울", postType: "카페",
      title: "제목", body: "본문 [사진1]", hashtags: ["#x"],
      imageMap: { "사진1": "01.jpg" },
    });
    const got = getHistory(db, rec.id);
    expect(got).not.toBeNull();
    expect(got!.title).toBe("제목");
    expect(got!.imageMap["사진1"]).toBe("01.jpg");
    expect(got!.hashtags).toEqual(["#x"]);
  });

  it("list newest first + delete", () => {
    const a = saveGeneration(db, {
      storeName: "A", address: null, postType: "맛집",
      title: "A제목", body: "", hashtags: [], imageMap: {},
    });
    const b = saveGeneration(db, {
      storeName: "B", address: null, postType: "맛집",
      title: "B제목", body: "", hashtags: [], imageMap: {},
    });
    expect(listHistory(db).map((h) => h.id)).toEqual([b.id, a.id]);
    deleteHistory(db, a.id);
    expect(listHistory(db).map((h) => h.id)).toEqual([b.id]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/storage/history.ts`:

```ts
import type { Database } from "better-sqlite3";
import { randomUUID } from "crypto";
import type { HistoryRecord, PostType } from "@shared/types";

interface SaveInput {
  storeName: string;
  address: string | null;
  postType: PostType;
  title: string;
  body: string;
  hashtags: string[];
  imageMap: Record<string, string>;
}

interface Row {
  id: string;
  store_name: string;
  address: string | null;
  post_type: PostType;
  title: string;
  body: string;
  hashtags: string;
  image_map: string;
  created_at: string;
}

const toRecord = (r: Row): HistoryRecord => ({
  id: r.id,
  storeName: r.store_name,
  address: r.address ?? undefined,
  postType: r.post_type,
  title: r.title,
  body: r.body,
  hashtags: JSON.parse(r.hashtags),
  imageMap: JSON.parse(r.image_map),
  createdAt: r.created_at,
});

export function saveGeneration(db: Database, input: SaveInput): HistoryRecord {
  const id = randomUUID().slice(0, 12);
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO generations (id, store_name, address, post_type, title, body, hashtags, image_map, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.storeName, input.address, input.postType, input.title,
    input.body, JSON.stringify(input.hashtags), JSON.stringify(input.imageMap),
    createdAt,
  );
  return {
    id, storeName: input.storeName, address: input.address ?? undefined,
    postType: input.postType, title: input.title, body: input.body,
    hashtags: input.hashtags, imageMap: input.imageMap, createdAt,
  };
}

export function listHistory(db: Database): HistoryRecord[] {
  const rows = db
    .prepare("SELECT * FROM generations ORDER BY created_at DESC")
    .all() as Row[];
  return rows.map(toRecord);
}

export function getHistory(db: Database, id: string): HistoryRecord | null {
  const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Row | undefined;
  return row ? toRecord(row) : null;
}

export function deleteHistory(db: Database, id: string): void {
  db.prepare("DELETE FROM generations WHERE id = ?").run(id);
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/storage/history.test.ts
git add src/main/storage/history.ts tests/main/storage/history.test.ts
git commit -m "feat(storage): generation history CRUD"
```

---

### Task 8: 설정 + safeStorage 키 저장

**Files:**
- Create: `src/main/storage/settings.ts`
- Test: `tests/main/storage/settings.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

// safeStorage 모킹: 평문으로 동작하게 만들어 테스트에서만 단순화
vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s, "utf-8"),
    decryptString: (b: Buffer) => b.toString("utf-8"),
  },
  app: {
    getPath: () => fs.mkdtempSync(path.join(os.tmpdir(), "nbw-test-")),
  },
}));

import {
  getSettings, setProvider, setWebSearch, setApiKey, clearApiKey, getApiKey,
} from "@main/storage/settings";

describe("settings", () => {
  beforeEach(() => {
    // electron-store가 캐시되어 있을 수 있으므로 import 시점 격리에 주의
  });

  it("default settings: claude provider, web search off", () => {
    const s = getSettings();
    expect(s.provider).toBe("claude");
    expect(s.useWebSearch).toBe(false);
    expect(s.hasApiKey.claude).toBe(false);
    expect(s.hasApiKey.gemini).toBe(false);
  });

  it("set+get provider and webSearch", () => {
    setProvider("gemini");
    setWebSearch(true);
    const s = getSettings();
    expect(s.provider).toBe("gemini");
    expect(s.useWebSearch).toBe(true);
  });

  it("set+get api key, hasApiKey flag updates", () => {
    setApiKey("claude", "sk-test");
    expect(getApiKey("claude")).toBe("sk-test");
    expect(getSettings().hasApiKey.claude).toBe(true);
    clearApiKey("claude");
    expect(getApiKey("claude")).toBeNull();
    expect(getSettings().hasApiKey.claude).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/storage/settings.ts`:

```ts
import { app, safeStorage } from "electron";
import Store from "electron-store";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import type { Provider, Settings, SettingsWithKeyStatus } from "@shared/types";

type StoreSchema = { provider: Provider; useWebSearch: boolean };

const store = new Store<StoreSchema>({
  defaults: { provider: "claude", useWebSearch: false },
});

function keysDir(): string {
  const dir = join(app.getPath("userData"), "keys");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function keyPath(p: Provider): string {
  return join(keysDir(), `${p}.bin`);
}

export function getSettings(): SettingsWithKeyStatus {
  return {
    provider: store.get("provider"),
    useWebSearch: store.get("useWebSearch"),
    hasApiKey: {
      claude: existsSync(keyPath("claude")),
      gemini: existsSync(keyPath("gemini")),
    },
  };
}

export function setProvider(p: Provider): void {
  store.set("provider", p);
}

export function setWebSearch(on: boolean): void {
  store.set("useWebSearch", on);
}

export function setApiKey(p: Provider, key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS 보안 저장소를 사용할 수 없습니다.");
  }
  const enc = safeStorage.encryptString(key);
  writeFileSync(keyPath(p), enc);
}

export function getApiKey(p: Provider): string | null {
  const path = keyPath(p);
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return safeStorage.decryptString(buf);
}

export function clearApiKey(p: Provider): void {
  const path = keyPath(p);
  if (existsSync(path)) unlinkSync(path);
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/storage/settings.test.ts
git add src/main/storage/settings.ts tests/main/storage/settings.test.ts
git commit -m "feat(storage): settings + safeStorage api key persistence"
```

---

## Phase 2 — 이미지 처리

### Task 9: 이미지 리사이즈 + base64

**Files:**
- Create: `src/main/images/load.ts`
- Test: `tests/main/images/load.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/main/images/load.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { prepareImage, MAX_LONG_EDGE } from "@main/images/load";

async function makeJpegBuffer(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
}

describe("prepareImage", () => {
  it("returns jpeg media type for jpeg input", async () => {
    const buf = await makeJpegBuffer(400, 300);
    const out = await prepareImage("test.jpg", buf);
    expect(out.mediaType).toBe("image/jpeg");
    expect(out.filename).toBe("test.jpg");
    expect(out.base64.length).toBeGreaterThan(0);
  });

  it("resizes images longer than MAX_LONG_EDGE", async () => {
    const buf = await makeJpegBuffer(4000, 3000);
    const out = await prepareImage("big.jpg", buf);
    const decoded = Buffer.from(out.base64, "base64");
    const meta = await sharp(decoded).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(MAX_LONG_EDGE);
  });

  it("rejects unsupported extensions", async () => {
    const buf = Buffer.from("not an image");
    await expect(prepareImage("test.gif", buf)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/images/load.ts`:

```ts
import sharp from "sharp";
import { extname } from "path";
import type { ImageInput } from "@shared/types";

export const MAX_LONG_EDGE = 1568;
const SUPPORTED = new Set([".jpg", ".jpeg", ".png"]);

export async function prepareImage(
  filename: string,
  buffer: Buffer,
): Promise<ImageInput> {
  const ext = extname(filename).toLowerCase();
  if (!SUPPORTED.has(ext)) {
    throw new Error(`지원하지 않는 확장자: ${ext}`);
  }
  const isPng = ext === ".png";

  let pipeline = sharp(buffer).rotate(); // auto-orient via EXIF
  const meta = await sharp(buffer).metadata();
  if (meta.width && meta.height && Math.max(meta.width, meta.height) > MAX_LONG_EDGE) {
    pipeline = pipeline.resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let outBuf: Buffer;
  let mediaType: "image/jpeg" | "image/png";
  if (isPng) {
    outBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    mediaType = "image/png";
  } else {
    outBuf = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    mediaType = "image/jpeg";
  }

  return {
    filename,
    mediaType,
    base64: outBuf.toString("base64"),
  };
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/images/load.test.ts
git add src/main/images/load.ts tests/main/images/load.test.ts
git commit -m "feat(images): sharp resize + base64 prep"
```

---

## Phase 3 — LLM Provider 추상화

### Task 10: 프롬프트 + Provider 인터페이스

**Files:**
- Create: `src/main/llm/types.ts`
- Create: `src/main/llm/prompts.ts`
- Test: `tests/main/llm/prompts.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, it, expect } from "vitest";
import {
  buildAnalyzeSystemPrompt,
  buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt,
  buildGenerateUserPrompt,
} from "@main/llm/prompts";
import type { StyleProfile } from "@shared/types";

const PROFILE: StyleProfile = {
  toneDistribution: { 해요: 0.8, 합니다: 0.2 },
  avgSentenceLength: 30,
  commonExpressions: ["진짜", "완전"],
  emojiFrequency: "low",
  structureNotes: "도입-본문-마무리",
  photoDescriptionStyle: "감성",
  sourceHash: "x", sampleCount: 10, updatedAt: "2026-05-15T00:00:00.000Z",
};

describe("prompts", () => {
  it("analyze system prompt asks for JSON", () => {
    expect(buildAnalyzeSystemPrompt()).toContain("JSON");
  });

  it("analyze user prompt embeds samples", () => {
    const p = buildAnalyzeUserPrompt(["글1", "글2"]);
    expect(p).toContain("글1");
    expect(p).toContain("글2");
  });

  it("generate system prompt embeds profile fields", () => {
    const p = buildGenerateSystemPrompt(PROFILE);
    expect(p).toContain("진짜");
    expect(p).toContain("도입-본문-마무리");
  });

  it("generate user prompt contains store, length and markers", () => {
    const p = buildGenerateUserPrompt({
      info: {
        storeName: "X카페", address: "서울", postType: "카페",
        keywords: [], length: 1500, tone: "my_style", emphasis: "",
      },
      memo: "좋은 곳",
      images: [],
      useWebSearch: false,
    }, ["사진1", "사진2"]);
    expect(p).toContain("X카페");
    expect(p).toContain("1500");
    expect(p).toContain("[사진1]");
    expect(p).toContain("[사진2]");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: `src/main/llm/types.ts` 구현**

```ts
import type {
  GenerateInput, GenerationResult, Provider, StyleProfile, StyleProfileCore,
} from "@shared/types";

export interface LLMProvider {
  readonly name: Provider;
  validateApiKey(): Promise<boolean>;
  analyzeStyle(samples: string[]): Promise<StyleProfileCore>;
  generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];
  }): Promise<GenerationResult>;
}
```

- [ ] **Step 4: `src/main/llm/prompts.ts` 구현**

```ts
import type { GenerateInput, StyleProfile } from "@shared/types";

export function buildAnalyzeSystemPrompt(): string {
  return `당신은 한국어 블로그 글의 문체와 구성을 분석하는 전문가입니다.
사용자가 직접 작성한 여러 편의 블로그 글을 보고, 그 사람의 고유한 글쓰기 스타일을 추출하여 아래 JSON으로만 응답하세요. 다른 텍스트 금지.

{
  "toneDistribution": {"해요": float, "합니다": float, "반말": float},
  "avgSentenceLength": int,
  "commonExpressions": [string, ...],
  "emojiFrequency": "none" | "low" | "medium" | "high",
  "structureNotes": string,
  "photoDescriptionStyle": string
}`;
}

export function buildAnalyzeUserPrompt(samples: string[]): string {
  const parts = ["아래는 사용자가 직접 쓴 블로그 글들입니다. 분석해주세요.\n"];
  samples.forEach((s, i) => parts.push(`---\n[글 ${i + 1}]\n${s}\n`));
  return parts.join("\n");
}

export function buildGenerateSystemPrompt(profile: StyleProfile): string {
  return `당신은 사용자의 블로그 글쓰기 스타일을 모방하여 네이버 블로그용 방문 후기 글을 작성하는 작가입니다.
아래는 사용자의 스타일 프로파일입니다. 반드시 이 스타일을 반영하세요.

\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

출력 규칙:
1) 응답은 반드시 아래 JSON 한 덩어리만 출력. 다른 텍스트 금지.
   {"title": string, "body": string, "hashtags": [string, ...]}
2) body 안에 [사진N] 마커를 본문 흐름상 자연스러운 위치에 삽입.
3) 모든 사진을 본문에 한 번씩 등장시키고, 같은 사진을 두 번 인용 금지.
4) 글자수는 목표치 ±20% 이내. (마커는 글자수에 포함하지 않음.)
5) 광고처럼 보이지 않게, 사용자의 평소 말투/구조/표현을 그대로 사용.
6) hashtags는 5~10개, 각 항목은 '#' 없이 키워드만.`;
}

export function buildGenerateUserPrompt(
  input: GenerateInput,
  imageMarkers: string[],
): string {
  const { info, memo } = input;
  const lines: string[] = [
    "다음 정보로 네이버 블로그용 방문 후기 글을 작성해주세요.",
    "",
    `- 매장명: ${info.storeName}`,
    `- 주소: ${info.address}`,
  ];
  if (info.visitDate) lines.push(`- 방문일: ${info.visitDate}`);
  lines.push(`- 글 타입: ${info.postType}`);
  lines.push(`- 목표 글자수: ${info.length}자 (±20%)`);

  if (info.tone === "my_style") {
    lines.push("- 말투: 사용자의 스타일 프로파일을 그대로 따를 것.");
  } else {
    lines.push(`- 말투: 반드시 '${info.tone}' 어미를 사용할 것.`);
  }
  if (info.title) lines.push(`- 제목(고정): ${info.title}`);
  else lines.push("- 제목: 적절한 제목을 직접 지어줄 것.");

  if (info.keywords.length) {
    lines.push(`- SEO 키워드 (본문에 자연스럽게 포함): ${info.keywords.join(", ")}`);
  }
  if (info.emphasis) {
    lines.push("- 강조/제외 사항:");
    lines.push(info.emphasis);
  }
  if (memo) {
    lines.push("");
    lines.push("[방문 메모]");
    lines.push(memo);
  }
  if (imageMarkers.length) {
    const markers = imageMarkers.map((m) => `[${m}]`).join(", ");
    lines.push("");
    lines.push(`[첨부 사진 마커]\n사용 가능한 마커: ${markers}\n첨부된 이미지들을 보고, 본문 흐름상 자연스러운 위치에 마커를 삽입하세요.`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 5: 테스트 통과 + commit**

```bash
npm test -- tests/main/llm/prompts.test.ts
git add src/main/llm/types.ts src/main/llm/prompts.ts tests/main/llm/prompts.test.ts
git commit -m "feat(llm): provider interface + prompt builders"
```

---

### Task 11: Claude Provider

**Files:**
- Create: `src/main/llm/claude.ts`
- Test: `tests/main/llm/claude.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, it, expect, vi } from "vitest";
import { ClaudeProvider } from "@main/llm/claude";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: (args: unknown) => mockCreate(args) },
  })),
}));

const PROFILE = {
  toneDistribution: { 해요: 1 }, avgSentenceLength: 25,
  commonExpressions: [], emojiFrequency: "none" as const,
  structureNotes: "", photoDescriptionStyle: "",
  sourceHash: "x", sampleCount: 5, updatedAt: "2026-05-15T00:00:00Z",
};

describe("ClaudeProvider", () => {
  it("analyzeStyle parses JSON response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        toneDistribution: { 해요: 1.0 },
        avgSentenceLength: 30,
        commonExpressions: ["진짜"],
        emojiFrequency: "low",
        structureNotes: "S",
        photoDescriptionStyle: "P",
      }) }],
    });
    const p = new ClaudeProvider("sk-test");
    const result = await p.analyzeStyle(["글1", "글2"]);
    expect(result.commonExpressions).toEqual(["진짜"]);
  });

  it("generatePost sends image blocks and parses result", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({
        title: "T", body: "B [사진1]", hashtags: ["x"],
      }) }],
    });
    const p = new ClaudeProvider("sk-test");
    const result = await p.generatePost({
      profile: PROFILE,
      input: {
        info: {
          storeName: "S", address: "A", postType: "카페",
          keywords: [], length: 1500, tone: "my_style", emphasis: "",
        },
        memo: "", useWebSearch: false,
        images: [{ filename: "a.jpg", mediaType: "image/jpeg", base64: "AAAA" }],
      },
      imageMarkers: ["사진1"],
    });
    expect(result.title).toBe("T");
    expect(result.imageMap).toEqual({ "사진1": "a.jpg" });

    const calledWith = mockCreate.mock.calls[0][0];
    const content = calledWith.messages[0].content;
    const imageBlock = content.find((b: { type: string }) => b.type === "image");
    expect(imageBlock).toBeTruthy();
  });

  it("strips code fences from response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '```json\n{"title":"T","body":"B","hashtags":[]}\n```' }],
    });
    const p = new ClaudeProvider("sk-test");
    const r = await p.generatePost({
      profile: PROFILE,
      input: {
        info: {
          storeName: "S", address: "A", postType: "카페",
          keywords: [], length: 1500, tone: "my_style", emphasis: "",
        },
        memo: "", useWebSearch: false, images: [],
      },
      imageMarkers: [],
    });
    expect(r.title).toBe("T");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/llm/claude.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./types";
import type {
  GenerateInput, GenerationResult, StyleProfile, StyleProfileCore,
} from "@shared/types";
import {
  buildAnalyzeSystemPrompt, buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt, buildGenerateUserPrompt,
} from "./prompts";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;
const FENCE_RE = /^```(?:json)?\s*|\s*```$/gm;

function parseJson<T>(text: string): T {
  const cleaned = text.replace(FENCE_RE, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Claude JSON 파싱 실패: ${(e as Error).message}\n원문: ${text.slice(0, 300)}`);
  }
}

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude" as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: MODEL, max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      });
      return true;
    } catch {
      return false;
    }
  }

  async analyzeStyle(samples: string[]): Promise<StyleProfileCore> {
    const message = await this.client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS,
      system: buildAnalyzeSystemPrompt(),
      messages: [{ role: "user", content: buildAnalyzeUserPrompt(samples) }],
    });
    const text = this.extractText(message);
    return parseJson<StyleProfileCore>(text);
  }

  async generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];
  }): Promise<GenerationResult> {
    const { profile, input, imageMarkers } = args;
    const content: Anthropic.Messages.ContentBlockParam[] = [];
    for (const img of input.images) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      });
    }
    content.push({ type: "text", text: buildGenerateUserPrompt(input, imageMarkers) });

    const message = await this.client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS,
      system: [{
        type: "text",
        text: buildGenerateSystemPrompt(profile),
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content }],
    });

    const text = this.extractText(message);
    const raw = parseJson<{ title: string; body: string; hashtags: string[] }>(text);

    const imageMap: Record<string, string> = {};
    input.images.forEach((img, i) => {
      imageMap[`사진${i + 1}`] = img.filename;
    });

    return {
      title: raw.title,
      body: raw.body,
      hashtags: raw.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
      imageMap,
    };
  }

  private extractText(message: Anthropic.Messages.Message): string {
    for (const b of message.content) {
      if (b.type === "text") return b.text;
    }
    throw new Error("Claude 응답에 text 블록이 없습니다.");
  }
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/llm/claude.test.ts
git add src/main/llm/claude.ts tests/main/llm/claude.test.ts
git commit -m "feat(llm): claude provider"
```

---

### Task 12: Gemini Provider

**Files:**
- Create: `src/main/llm/gemini.ts`
- Test: `tests/main/llm/gemini.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, it, expect, vi } from "vitest";
import { GeminiProvider } from "@main/llm/gemini";

const mockGenerate = vi.fn();
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: (req: unknown) => mockGenerate(req),
    }),
  })),
}));

const PROFILE = {
  toneDistribution: { 해요: 1 }, avgSentenceLength: 25,
  commonExpressions: [], emojiFrequency: "none" as const,
  structureNotes: "", photoDescriptionStyle: "",
  sourceHash: "x", sampleCount: 5, updatedAt: "2026-05-15T00:00:00Z",
};

describe("GeminiProvider", () => {
  it("analyzeStyle parses JSON response", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({
        toneDistribution: { 해요: 1.0 }, avgSentenceLength: 28,
        commonExpressions: ["완전"], emojiFrequency: "medium",
        structureNotes: "X", photoDescriptionStyle: "Y",
      }) },
    });
    const p = new GeminiProvider("g-test");
    const r = await p.analyzeStyle(["글1"]);
    expect(r.commonExpressions).toEqual(["완전"]);
  });

  it("generatePost sends inline image data and parses result", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({
        title: "T", body: "B [사진1]", hashtags: ["a"],
      }) },
    });
    const p = new GeminiProvider("g-test");
    const r = await p.generatePost({
      profile: PROFILE,
      input: {
        info: {
          storeName: "S", address: "A", postType: "카페",
          keywords: [], length: 1500, tone: "my_style", emphasis: "",
        },
        memo: "", useWebSearch: false,
        images: [{ filename: "a.jpg", mediaType: "image/jpeg", base64: "AAAA" }],
      },
      imageMarkers: ["사진1"],
    });
    expect(r.title).toBe("T");
    expect(r.imageMap["사진1"]).toBe("a.jpg");

    const arg = mockGenerate.mock.calls[0][0];
    const parts = arg.contents[0].parts;
    const inline = parts.find((p: { inlineData?: unknown }) => p.inlineData);
    expect(inline).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/llm/gemini.ts`:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProvider } from "./types";
import type {
  GenerateInput, GenerationResult, StyleProfile, StyleProfileCore,
} from "@shared/types";
import {
  buildAnalyzeSystemPrompt, buildAnalyzeUserPrompt,
  buildGenerateSystemPrompt, buildGenerateUserPrompt,
} from "./prompts";

const MODEL_NAME = "gemini-2.5-flash";
const FENCE_RE = /^```(?:json)?\s*|\s*```$/gm;

function parseJson<T>(text: string): T {
  const cleaned = text.replace(FENCE_RE, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Gemini JSON 파싱 실패: ${(e as Error).message}\n원문: ${text.slice(0, 300)}`);
  }
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: MODEL_NAME });
      await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 8 },
      });
      return true;
    } catch {
      return false;
    }
  }

  async analyzeStyle(samples: string[]): Promise<StyleProfileCore> {
    const model = this.client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: buildAnalyzeSystemPrompt(),
      generationConfig: { responseMimeType: "application/json" },
    });
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: buildAnalyzeUserPrompt(samples) }] }],
    });
    return parseJson<StyleProfileCore>(res.response.text());
  }

  async generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];
  }): Promise<GenerationResult> {
    const { profile, input, imageMarkers } = args;
    const model = this.client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: buildGenerateSystemPrompt(profile),
      generationConfig: { responseMimeType: "application/json" },
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    for (const img of input.images) {
      parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
    }
    parts.push({ text: buildGenerateUserPrompt(input, imageMarkers) });

    const res = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    const raw = parseJson<{ title: string; body: string; hashtags: string[] }>(
      res.response.text(),
    );

    const imageMap: Record<string, string> = {};
    input.images.forEach((img, i) => {
      imageMap[`사진${i + 1}`] = img.filename;
    });

    return {
      title: raw.title,
      body: raw.body,
      hashtags: raw.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
      imageMap,
    };
  }
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/llm/gemini.test.ts
git add src/main/llm/gemini.ts tests/main/llm/gemini.test.ts
git commit -m "feat(llm): gemini provider"
```

---

### Task 13: Provider 팩토리

**Files:**
- Create: `src/main/llm/index.ts`

- [ ] **Step 1: 구현 (테스트 없음 — 단순 dispatch)**

```ts
import type { Provider } from "@shared/types";
import type { LLMProvider } from "./types";
import { ClaudeProvider } from "./claude";
import { GeminiProvider } from "./gemini";

export function makeProvider(name: Provider, apiKey: string): LLMProvider {
  switch (name) {
    case "claude": return new ClaudeProvider(apiKey);
    case "gemini": return new GeminiProvider(apiKey);
  }
}

export type { LLMProvider } from "./types";
```

- [ ] **Step 2: typecheck + commit**

```bash
npm run typecheck
git add src/main/llm/index.ts
git commit -m "feat(llm): provider factory"
```

---

## Phase 4 — 비즈니스 서비스

### Task 14: 스타일 분석 서비스

**Files:**
- Create: `src/main/services/styleAnalyzer.ts`
- Test: `tests/main/services/styleAnalyzer.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@main/storage/db";
import { addSample } from "@main/storage/samples";
import { loadProfile } from "@main/storage/styleProfile";
import { runAnalyze, MIN_SAMPLES_WARN } from "@main/services/styleAnalyzer";
import type { LLMProvider } from "@main/llm";

const fakeProvider = (): LLMProvider => ({
  name: "claude",
  validateApiKey: async () => true,
  analyzeStyle: async () => ({
    toneDistribution: { 해요: 1 },
    avgSentenceLength: 25,
    commonExpressions: ["진짜"],
    emojiFrequency: "low",
    structureNotes: "",
    photoDescriptionStyle: "",
  }),
  generatePost: async () => { throw new Error("not used"); },
});

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(":memory:"); });

describe("runAnalyze", () => {
  it("throws when no samples", async () => {
    await expect(runAnalyze(db, fakeProvider())).rejects.toThrow();
  });

  it("saves profile with sourceHash and sampleCount", async () => {
    for (let i = 0; i < 6; i++) addSample(db, { label: `${i}`, body: `글${i}` });
    const profile = await runAnalyze(db, fakeProvider());
    expect(profile.sampleCount).toBe(6);
    const loaded = loadProfile(db);
    expect(loaded?.sourceHash).toBe(profile.sourceHash);
  });

  it("includes warning when samples below threshold", async () => {
    for (let i = 0; i < MIN_SAMPLES_WARN - 1; i++) {
      addSample(db, { label: `${i}`, body: `글${i}` });
    }
    const warnings: string[] = [];
    await runAnalyze(db, fakeProvider(), { onWarning: (w) => warnings.push(w) });
    expect(warnings.some((w) => w.includes("5개 미만"))).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/services/styleAnalyzer.ts`:

```ts
import type { Database } from "better-sqlite3";
import type { LLMProvider } from "@main/llm";
import { getAllBodies } from "@main/storage/samples";
import { saveProfile } from "@main/storage/styleProfile";
import type { StyleProfile } from "@shared/types";

export const MIN_SAMPLES_WARN = 5;

export async function runAnalyze(
  db: Database,
  provider: LLMProvider,
  opts: { onWarning?: (msg: string) => void; onProgress?: (stage: string) => void } = {},
): Promise<StyleProfile> {
  const bodies = getAllBodies(db);
  if (bodies.length === 0) {
    throw new Error("등록된 스타일 샘플이 없습니다. 먼저 글을 추가해주세요.");
  }
  if (bodies.length < MIN_SAMPLES_WARN) {
    opts.onWarning?.(
      `샘플이 ${bodies.length}개로 5개 미만입니다. 스타일 분석 정확도가 떨어질 수 있습니다.`,
    );
  }
  opts.onProgress?.("분석 중");
  const core = await provider.analyzeStyle(bodies);
  return saveProfile(db, core);
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/services/styleAnalyzer.test.ts
git add src/main/services/styleAnalyzer.ts tests/main/services/styleAnalyzer.test.ts
git commit -m "feat(services): style analyzer"
```

---

### Task 15: 글 생성 서비스

**Files:**
- Create: `src/main/services/postGenerator.ts`
- Test: `tests/main/services/postGenerator.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@main/storage/db";
import { saveProfile } from "@main/storage/styleProfile";
import { addSample } from "@main/storage/samples";
import { listHistory } from "@main/storage/history";
import { runGenerate } from "@main/services/postGenerator";
import type { LLMProvider } from "@main/llm";
import type { GenerationResult, GenerateInput } from "@shared/types";

const baseInput: GenerateInput = {
  info: {
    storeName: "X카페", address: "서울", postType: "카페",
    keywords: [], length: 1500, tone: "my_style", emphasis: "",
  },
  memo: "메모",
  images: [
    { filename: "01.jpg", mediaType: "image/jpeg", base64: "AAAA" },
    { filename: "02.jpg", mediaType: "image/jpeg", base64: "BBBB" },
  ],
  useWebSearch: false,
};

const makeProvider = (result: GenerationResult): LLMProvider => ({
  name: "claude",
  validateApiKey: async () => true,
  analyzeStyle: async () => { throw new Error("not used"); },
  generatePost: async () => result,
});

let db: ReturnType<typeof openDatabase>;
beforeEach(() => {
  db = openDatabase(":memory:");
  addSample(db, { label: "a", body: "샘플 1" });
  saveProfile(db, {
    toneDistribution: { 해요: 1 }, avgSentenceLength: 25,
    commonExpressions: [], emojiFrequency: "none",
    structureNotes: "", photoDescriptionStyle: "",
  });
});

describe("runGenerate", () => {
  it("saves to history and returns result + record", async () => {
    const provider = makeProvider({
      title: "T",
      body: "본문 [사진1] 중간 [사진2]" + "가".repeat(1450),
      hashtags: ["x"],
      imageMap: { "사진1": "01.jpg", "사진2": "02.jpg" },
    });
    const { result, record, warnings } = await runGenerate(db, provider, baseInput);
    expect(result.title).toBe("T");
    expect(record.storeName).toBe("X카페");
    expect(warnings).toHaveLength(0);
    expect(listHistory(db)).toHaveLength(1);
  });

  it("warns when markers are missing", async () => {
    const provider = makeProvider({
      title: "T", body: "[사진1]만", hashtags: [],
      imageMap: { "사진1": "01.jpg", "사진2": "02.jpg" },
    });
    const { warnings } = await runGenerate(db, provider, baseInput);
    expect(warnings.some((w) => w.includes("사진2"))).toBe(true);
  });

  it("warns when length is far off target", async () => {
    const provider = makeProvider({
      title: "T", body: "짧음 [사진1] [사진2]", hashtags: [],
      imageMap: { "사진1": "01.jpg", "사진2": "02.jpg" },
    });
    const { warnings } = await runGenerate(db, provider, baseInput);
    expect(warnings.some((w) => w.includes("글자수"))).toBe(true);
  });

  it("throws when style profile missing", async () => {
    const empty = openDatabase(":memory:");
    await expect(
      runGenerate(empty, makeProvider({} as GenerationResult), baseInput),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`src/main/services/postGenerator.ts`:

```ts
import type { Database } from "better-sqlite3";
import type { LLMProvider } from "@main/llm";
import { loadProfile } from "@main/storage/styleProfile";
import { saveGeneration } from "@main/storage/history";
import type { GenerateInput, GenerationResult, HistoryRecord } from "@shared/types";

const LENGTH_TOLERANCE = 0.2;

export interface GenerateOutcome {
  result: GenerationResult;
  record: HistoryRecord;
  warnings: string[];
}

export async function runGenerate(
  db: Database,
  provider: LLMProvider,
  input: GenerateInput,
  opts: { onProgress?: (stage: string) => void } = {},
): Promise<GenerateOutcome> {
  const profile = loadProfile(db);
  if (!profile) {
    throw new Error("스타일 프로파일이 없습니다. 먼저 분석을 실행해주세요.");
  }

  const imageMarkers = input.images.map((_, i) => `사진${i + 1}`);
  opts.onProgress?.("작성 중");

  const result = await provider.generatePost({ profile, input, imageMarkers });

  const warnings = validate(result, imageMarkers, input.info.length);

  const record = saveGeneration(db, {
    storeName: input.info.storeName,
    address: input.info.address || null,
    postType: input.info.postType,
    title: result.title,
    body: result.body,
    hashtags: result.hashtags,
    imageMap: result.imageMap,
  });

  return { result, record, warnings };
}

function validate(
  result: GenerationResult,
  expectedMarkers: string[],
  targetLength: number,
): string[] {
  const warnings: string[] = [];
  const found = new Set(result.body.match(/\[사진\d+\]/g) ?? []);
  const expected = new Set(expectedMarkers.map((m) => `[${m}]`));
  const missing = [...expected].filter((m) => !found.has(m));
  const extra = [...found].filter((m) => !expected.has(m));
  if (missing.length) warnings.push(`본문에 빠진 사진 마커: ${missing.join(", ")}`);
  if (extra.length) warnings.push(`존재하지 않는 사진을 가리키는 마커: ${extra.join(", ")}`);

  const bodyNoMarkers = result.body.replace(/\[사진\d+\]/g, "");
  const actual = bodyNoMarkers.length;
  const low = Math.floor(targetLength * (1 - LENGTH_TOLERANCE));
  const high = Math.ceil(targetLength * (1 + LENGTH_TOLERANCE));
  if (actual < low || actual > high) {
    warnings.push(`글자수 ${actual}자 — 목표 ${targetLength}자 (허용 ${low}~${high}) 벗어남.`);
  }

  return warnings;
}
```

- [ ] **Step 4: 테스트 통과 + commit**

```bash
npm test -- tests/main/services/postGenerator.test.ts
git add src/main/services/postGenerator.ts tests/main/services/postGenerator.test.ts
git commit -m "feat(services): post generator with validation + history save"
```

---

## Phase 5 — IPC 레이어

### Task 16: IPC 채널 + 핸들러 등록

**Files:**
- Create: `src/main/ipc.ts`
- Create: `src/main/db-singleton.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: `src/main/db-singleton.ts`**

```ts
import { app } from "electron";
import { join } from "path";
import { openDatabase } from "./storage/db";
import type { Database } from "better-sqlite3";

let _db: Database | null = null;
export function getDb(): Database {
  if (!_db) {
    const path = join(app.getPath("userData"), "naver-blog-writer.db");
    _db = openDatabase(path);
  }
  return _db;
}
```

- [ ] **Step 2: `src/main/ipc.ts`**

```ts
import { ipcMain, BrowserWindow } from "electron";
import {
  getSettings, setProvider, setWebSearch, setApiKey, clearApiKey, getApiKey,
} from "./storage/settings";
import { addSample, listSamples, deleteSample } from "./storage/samples";
import { loadProfile } from "./storage/styleProfile";
import { listHistory, getHistory, deleteHistory } from "./storage/history";
import { runAnalyze } from "./services/styleAnalyzer";
import { runGenerate } from "./services/postGenerator";
import { makeProvider } from "./llm";
import { getDb } from "./db-singleton";
import type { Provider, GenerateInput } from "@shared/types";

function emitProgress(channel: string, stage: string) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, stage);
  }
}

function requireApiKey(provider: Provider): string {
  const key = getApiKey(provider);
  if (!key) throw new Error(`${provider} API 키가 설정되지 않았습니다.`);
  return key;
}

export function registerIpc(): void {
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:setProvider", (_e, p: Provider) => setProvider(p));
  ipcMain.handle("settings:setWebSearch", (_e, on: boolean) => setWebSearch(on));
  ipcMain.handle("settings:setApiKey", (_e, p: Provider, key: string) => setApiKey(p, key));
  ipcMain.handle("settings:clearApiKey", (_e, p: Provider) => clearApiKey(p));
  ipcMain.handle("settings:validateApiKey", async (_e, p: Provider) => {
    const key = getApiKey(p);
    if (!key) return false;
    return await makeProvider(p, key).validateApiKey();
  });

  ipcMain.handle("samples:list", () => listSamples(getDb()));
  ipcMain.handle("samples:add", (_e, input: { label: string; body: string }) =>
    addSample(getDb(), input),
  );
  ipcMain.handle("samples:delete", (_e, id: string) => deleteSample(getDb(), id));

  ipcMain.handle("style:getProfile", () => loadProfile(getDb()));
  ipcMain.handle("style:analyze", async () => {
    const { provider } = getSettings();
    const key = requireApiKey(provider);
    return runAnalyze(getDb(), makeProvider(provider, key), {
      onProgress: (s) => emitProgress("style:progress", s),
      onWarning: (w) => emitProgress("style:warning", w),
    });
  });

  ipcMain.handle("generate:run", async (_e, input: GenerateInput) => {
    const { provider } = getSettings();
    const key = requireApiKey(provider);
    return runGenerate(getDb(), makeProvider(provider, key), input, {
      onProgress: (s) => emitProgress("generate:progress", s),
    });
  });

  ipcMain.handle("history:list", () => listHistory(getDb()));
  ipcMain.handle("history:get", (_e, id: string) => getHistory(getDb(), id));
  ipcMain.handle("history:delete", (_e, id: string) => deleteHistory(getDb(), id));
}
```

- [ ] **Step 3: `src/main/index.ts` 갱신**

```ts
import { app, BrowserWindow } from "electron";
import { join } from "path";
import { registerIpc } from "./ipc";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 4: typecheck + commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(ipc): register all main process handlers"
```

---

### Task 17: Preload — typed IPC 노출

**Files:**
- Modify: `src/preload/index.ts`
- Create: `src/shared/api.ts` (renderer/preload 공통 타입)

- [ ] **Step 1: `src/shared/api.ts`**

```ts
import type {
  GenerateInput, GenerationResult, HistoryRecord, Provider, Sample,
  SettingsWithKeyStatus, StyleProfile,
} from "./types";
import type { GenerateOutcome } from "./generate-outcome";

// Re-export for clarity:
export type { GenerateOutcome };

export interface AppApi {
  settings: {
    get(): Promise<SettingsWithKeyStatus>;
    setProvider(p: Provider): Promise<void>;
    setWebSearch(on: boolean): Promise<void>;
    setApiKey(p: Provider, key: string): Promise<void>;
    clearApiKey(p: Provider): Promise<void>;
    validateApiKey(p: Provider): Promise<boolean>;
  };
  samples: {
    list(): Promise<Sample[]>;
    add(input: { label: string; body: string }): Promise<Sample>;
    delete(id: string): Promise<void>;
  };
  style: {
    getProfile(): Promise<StyleProfile | null>;
    analyze(): Promise<StyleProfile>;
    onProgress(cb: (stage: string) => void): () => void;
    onWarning(cb: (msg: string) => void): () => void;
  };
  generate: {
    run(input: GenerateInput): Promise<GenerateOutcome>;
    onProgress(cb: (stage: string) => void): () => void;
  };
  history: {
    list(): Promise<HistoryRecord[]>;
    get(id: string): Promise<HistoryRecord | null>;
    delete(id: string): Promise<void>;
  };
}

declare global {
  interface Window { api: AppApi }
}
```

`src/shared/generate-outcome.ts`:

```ts
import type { GenerationResult, HistoryRecord } from "./types";

export interface GenerateOutcome {
  result: GenerationResult;
  record: HistoryRecord;
  warnings: string[];
}
```

- [ ] **Step 2: `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { AppApi } from "@shared/api";

function on(channel: string, cb: (...args: unknown[]) => void): () => void {
  const handler = (_e: unknown, ...args: unknown[]) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: AppApi = {
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    setProvider: (p) => ipcRenderer.invoke("settings:setProvider", p),
    setWebSearch: (on) => ipcRenderer.invoke("settings:setWebSearch", on),
    setApiKey: (p, key) => ipcRenderer.invoke("settings:setApiKey", p, key),
    clearApiKey: (p) => ipcRenderer.invoke("settings:clearApiKey", p),
    validateApiKey: (p) => ipcRenderer.invoke("settings:validateApiKey", p),
  },
  samples: {
    list: () => ipcRenderer.invoke("samples:list"),
    add: (input) => ipcRenderer.invoke("samples:add", input),
    delete: (id) => ipcRenderer.invoke("samples:delete", id),
  },
  style: {
    getProfile: () => ipcRenderer.invoke("style:getProfile"),
    analyze: () => ipcRenderer.invoke("style:analyze"),
    onProgress: (cb) => on("style:progress", (stage) => cb(stage as string)),
    onWarning: (cb) => on("style:warning", (msg) => cb(msg as string)),
  },
  generate: {
    run: (input) => ipcRenderer.invoke("generate:run", input),
    onProgress: (cb) => on("generate:progress", (stage) => cb(stage as string)),
  },
  history: {
    list: () => ipcRenderer.invoke("history:list"),
    get: (id) => ipcRenderer.invoke("history:get", id),
    delete: (id) => ipcRenderer.invoke("history:delete", id),
  },
};

contextBridge.exposeInMainWorld("api", api);
```

- [ ] **Step 3: typecheck + dev로 부팅 + commit**

```bash
npm run typecheck
npm run dev   # 창이 뜨면 닫고
git add -A
git commit -m "feat(preload): typed app api over ipc"
```

---

## Phase 6 — 렌더러 (UI)

> 디자이너 마크업이 도착하기 전까지는 **기능 우선의 임시 UI**로 작성. 마크업 도착 후 디자인 통합은 별도 단계로 처리.

### Task 18: 라우터 + 레이아웃 + api 래퍼

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/Layout.tsx`
- Create: `src/renderer/api.ts`

- [ ] **Step 1: `src/renderer/api.ts`**

```ts
import type { AppApi } from "@shared/api";
export const api: AppApi = window.api;
```

- [ ] **Step 2: `src/renderer/Layout.tsx`**

```tsx
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
```

- [ ] **Step 3: `src/renderer/App.tsx`**

```tsx
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import Compose from "./routes/Compose";
import MyStyle from "./routes/MyStyle";
import History from "./routes/History";
import Settings from "./routes/Settings";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Compose />} />
          <Route path="/style" element={<MyStyle />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 4: 빈 스텁 페이지 4개**

`src/renderer/routes/Compose.tsx`:

```tsx
export default function Compose() {
  return <div>Compose</div>;
}
```

Same pattern for `MyStyle.tsx`, `History.tsx`, `Settings.tsx`.

- [ ] **Step 5: `npm run dev` 로 4페이지 네비게이션 확인 + commit**

```bash
git add -A
git commit -m "feat(renderer): router and sidebar layout"
```

---

### Task 19: Settings 페이지

**Files:**
- Modify: `src/renderer/routes/Settings.tsx`

- [ ] **Step 1: 구현 (디자이너 마크업 도착 전까지 단순 폼)**

```tsx
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
            onChange={(e) => api.settings.setWebSearch(e.target.checked).then(refresh)} />
          <span>웹 검색 사용 (최신 매장 정보 자동 조회)</span>
        </label>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: dev에서 키 저장/검증 동작 확인 + commit**

```bash
git add -A
git commit -m "feat(renderer): settings page"
```

---

### Task 20: My Style 페이지

**Files:**
- Modify: `src/renderer/routes/MyStyle.tsx`

- [ ] **Step 1: 구현**

```tsx
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
```

- [ ] **Step 2: commit**

```bash
git add -A
git commit -m "feat(renderer): my style page"
```

---

### Task 21: Compose 페이지 (메인)

**Files:**
- Modify: `src/renderer/routes/Compose.tsx`
- Create: `src/renderer/lib/readImage.ts`

- [ ] **Step 1: `src/renderer/lib/readImage.ts`**

```ts
import type { ImageInput } from "@shared/types";

export async function fileToImageInput(file: File): Promise<ImageInput> {
  const buf = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const mediaType: ImageInput["mediaType"] = file.type === "image/png" ? "image/png" : "image/jpeg";
  return { filename: file.name, mediaType, base64 };
}
```

> NOTE: 이미지 리사이즈는 main 프로세스의 `prepareImage`에서 하는 것이 정석이지만, 렌더러에서 raw base64를 보내고 main에서 다시 sharp로 리사이즈하는 흐름이 깔끔. 이 task에서는 단순히 base64만 만들고, 추가 IPC 채널 (`images:prepare`) 도입은 다음 다듬기 단계에서.

- [ ] **Step 2: 구현 (긴 컴포넌트 — 입력 패널 + 결과 패널 좌우)**

```tsx
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
    for (let i = 0; i < Math.min(files.length, 10 - images.length); i++) {
      inputs.push(await fileToImageInput(files[i]!));
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
      useWebSearch: false, // settings에서 결정되지만, 백엔드는 settings에서 다시 읽으므로 무시
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
        <p>스타일 프로파일이 아직 없습니다.</p>
        <Link to="/style" className="text-blue-600 underline">내 스타일에서 글을 등록하고 분석을 먼저 진행해주세요.</Link>
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
```

- [ ] **Step 3: commit**

```bash
git add -A
git commit -m "feat(renderer): compose page with form and result panel"
```

---

### Task 22: History 페이지

**Files:**
- Modify: `src/renderer/routes/History.tsx`

- [ ] **Step 1: 구현**

```tsx
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
```

- [ ] **Step 2: commit**

```bash
git add -A
git commit -m "feat(renderer): history page"
```

---

## Phase 7 — 빌드 & 마무리

### Task 23: electron-builder 설정 + 첫 빌드

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: `electron-builder.yml`**

```yaml
appId: com.naver-blog-writer.app
productName: 네이버 블로그 작성기
directories:
  output: release
files:
  - out/**/*
  - package.json
mac:
  target:
    - dmg
  category: public.app-category.productivity
  identity: null   # unsigned
win:
  target:
    - nsis
  artifactName: ${productName}-${version}-setup.${ext}
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 2: package.json에 빌드 명령 확인 (이미 추가됨)**

- [ ] **Step 3: Mac 빌드 시험 (현재 머신이 Mac이므로)**

```bash
npm run build:mac
```
Expected: `release/네이버 블로그 작성기-0.1.0.dmg` 생성. better-sqlite3 같은 네이티브 모듈이 자동 리빌드되어야 함.

- [ ] **Step 4: Windows 빌드 시험 (선택, Mac에서도 가능)**

```bash
npm run build:win
```
Note: Windows 빌드를 Mac에서 하면 wine 등이 필요할 수 있음. 안 되면 추후 Windows 머신에서 시도.

- [ ] **Step 5: 빌드 산출물 .gitignore 확인 + commit**

```bash
git add electron-builder.yml package.json
git commit -m "build: electron-builder config for mac/win"
```

---

### Task 24: README + 수동 스모크

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 작성**

```markdown
# 네이버 블로그 작성기

내 블로그 글 스타일을 학습해서 매장 사진/메모만 주면 글을 자동으로 써주는 데스크탑 앱.

- LLM 제공자: Claude 또는 Gemini (사용자가 자기 API 키 입력)
- 플랫폼: Mac, Windows
- 사용자 데이터: 본인 PC에만 저장 (외부 서버 없음)

## 개발 환경

```bash
npm install
npm run dev      # 개발 모드 (창 자동 열림)
npm test         # 테스트
```

## 빌드

```bash
npm run build:mac    # release/ 아래에 dmg 생성
npm run build:win    # release/ 아래에 nsis 설치 파일 생성
```

## 첫 실행 흐름

1. 앱을 열면 사이드바에 ⚙️ **설정** 클릭
2. Provider 선택 (Claude 또는 Gemini) → API 키 입력 → "연결 확인"으로 검증
3. (선택) 웹 검색 토글
4. 📚 **내 스타일** 으로 가서 본인 글 10~30개를 차례로 붙여넣어 저장
5. "스타일 분석 시작" 클릭 → 프로파일이 생성됨
6. ✍️ **글 작성** 으로 가서 매장 정보, 사진, 메모 입력 → "글 만들기"
7. 결과를 네이버 블로그에 복사하고, `[사진N]` 마커 위치에 사진을 끼워 게시
```

- [ ] **Step 2: 수동 스모크 체크리스트 (체크박스 그대로 둠)**

이 파일 아래에 "수동 검증" 섹션을 추가:

```markdown
## 수동 검증 체크리스트

- [ ] Settings: Claude/Gemini 두 provider 모두 키 저장 → 키 삭제 → 다시 저장
- [ ] Settings: 잘못된 키로 연결 확인 → 실패 메시지
- [ ] Settings: 올바른 키로 연결 확인 → 성공 메시지
- [ ] My Style: 6개 글 추가 → 분석 → 프로파일 카드 표시
- [ ] My Style: 5개 미만일 때 경고 표시
- [ ] Compose: 필수 필드 누락 시 버튼 비활성화
- [ ] Compose: 사진 10장 초과 업로드 시도 → 10장으로 제한
- [ ] Compose: 정상 생성 → 결과 패널에 제목/본문/해시태그/사진 매핑 표시
- [ ] Compose: 생성된 본문 편집 가능, 복사 동작
- [ ] History: 생성한 글이 목록에 표시 → 클릭하여 다시 열람 → 삭제 동작
- [ ] 앱 종료 후 재실행 시 키/샘플/프로파일/히스토리 모두 보존
```

- [ ] **Step 3: 전체 테스트 실행**

```bash
npm test
```
Expected: 모두 통과.

- [ ] **Step 4: commit**

```bash
git add README.md
git commit -m "docs: README with usage and manual smoke checklist"
```

---

## 디자이너 마크업 통합 (별도 단계)

디자이너 산출물(`design/` 폴더)이 도착하면:

1. `design/assets/css/tokens.css` 를 `src/renderer/styles/tokens.css` 로 복사하고 import
2. 디자이너의 페이지별 HTML(`design/pages/compose.html` 등)을 컴포넌트로 분해하여 `src/renderer/components/` 에 배치
3. 기존 `routes/*.tsx` 의 임시 마크업을 디자이너 컴포넌트로 교체
4. 시각 회귀 수동 확인

이 단계는 마크업이 도착한 시점에 별도 plan으로 처리합니다.

---

## Out of Scope (다음 이터레이션)

- 웹 검색 도구 실제 연결 (현재는 토글만 존재, generate 호출엔 미반영) — Task 21에서 명시
- 글 생성 진행 단계 SSE 스트리밍 (현재는 stage 문자열만)
- 자동 업데이트
- 코드 서명 (현재 unsigned 빌드)
- 다크 모드
