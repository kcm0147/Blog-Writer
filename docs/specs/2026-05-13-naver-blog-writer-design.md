# naver-blog-writer — 설계 문서 v3

- **최초 작성:** 2026-05-13
- **v3 갱신:** 2026-05-15 (Electron 데스크탑 앱으로 피벗)
- **상태:** 구현 단계

---

## 1. 한 줄 요약

사용자의 기존 네이버 블로그 글을 학습해, 매장 정보 + 메모 + 사진을 입력받아 네이버 블로그용 1500자 초안 + 제목 + 해시태그를 생성하는 **Electron 데스크탑 앱**. 사용자가 자신의 Claude 또는 Gemini API 키를 입력하여 로컬에서 동작.

---

## 2. 사용자 / 사용 시나리오

- **대상:** 비개발자 (블로그 운영자/리뷰어)
- **배포:** Mac + Windows 빌드된 앱을 직접 전달
- **단일 사용자, 단일 PC, 로컬 동작.** 서버 없음.

---

## 3. 기능 요구사항 (요약)

| 영역 | 요구사항 |
|------|---------|
| LLM 제공자 | Claude / Gemini 중 사용자가 선택 |
| API 키 | 설정 화면에서 입력, OS 보안 저장소(safeStorage)에 저장 |
| 웹검색 | 설정 토글, 기본 OFF (Claude의 web_search tool 또는 Gemini의 grounding) |
| 비전 분석 | 항상 ON (선택한 모델이 비전 지원 필수) |
| 스타일 학습 | GUI에서 본문 직접 붙여넣기로 샘플 등록 → 분석하여 프로파일 저장 |
| 글 생성 | 분야/매장 정보/사진/메모/말투/글자수 입력 → 제목+본문+해시태그+사진 마커 |
| 사진 | 최대 10장, jpg/jpeg/png, 5MB 자동 리사이징, `[사진N]` 마커로 본문에 위치 가이드 |
| 글자수 | 500/1000/**1500(기본)**/2000 |
| 말투 | 내 스타일(기본) / 해요 / 합니다 / 반말 |
| 히스토리 | 모든 생성 결과를 로컬 DB에 저장, 재열람 가능 |

---

## 4. 기술 스택

- **Electron** (최신 stable)
- **TypeScript 5.x**
- **React 18** + **Vite** (electron-vite로 main/preload/renderer 빌드)
- **Tailwind CSS** (디자이너 HTML 마크업과 호환되도록)
- **@anthropic-ai/sdk** — Claude
- **@google/generative-ai** — Gemini
- **better-sqlite3** — 로컬 DB (샘플, 스타일 프로파일, 히스토리)
- **electron-store** — 비밀번호가 아닌 설정값 (provider 선택, web search 토글 등)
- **electron.safeStorage** — OS 키체인을 활용한 API 키 암호화
- **sharp** — 이미지 리사이징
- **electron-builder** — Mac(.dmg), Windows(.exe NSIS) 패키징
- **vitest** + **@testing-library/react** — 테스트

---

## 5. 아키텍처 — 프로세스 분리

```
┌─────────────────────────────────────────────────┐
│  Renderer Process (React + TS)                  │
│   - UI (Compose / MyStyle / History / Settings) │
│   - window.api.*  (typed wrapper around IPC)    │
└────────────────────┬────────────────────────────┘
                     │ contextBridge (IPC)
┌────────────────────▼────────────────────────────┐
│  Preload Script                                 │
│   - 타입 안전한 IPC 채널 노출                    │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Main Process (Node.js)                         │
│   - LLM 호출 (API 키는 main에만 존재)           │
│   - SQLite, 파일 I/O, safeStorage              │
│   - sharp 이미지 처리                           │
└─────────────────────────────────────────────────┘
```

**보안 원칙:**
- API 키와 SDK 호출은 **main 프로세스에서만**. 렌더러는 절대 키를 보지 못함.
- 렌더러는 preload가 노출한 함수만 호출 가능 (contextIsolation: true, nodeIntegration: false).

---

## 6. 디렉터리 구조

```
naver-blog-writer/
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json
├── tsconfig.node.json
├── src/
│   ├── main/
│   │   ├── index.ts                # Electron app entry, BrowserWindow
│   │   ├── ipc.ts                  # IPC handler 등록
│   │   ├── llm/
│   │   │   ├── index.ts            # Provider 팩토리
│   │   │   ├── claude.ts           # Claude 구현
│   │   │   ├── gemini.ts           # Gemini 구현
│   │   │   ├── prompts.ts          # 분석/생성 프롬프트 (한국어)
│   │   │   └── types.ts            # Provider 인터페이스, 공유 타입
│   │   ├── storage/
│   │   │   ├── db.ts               # better-sqlite3 init + migrations
│   │   │   ├── samples.ts          # 샘플 CRUD
│   │   │   ├── styleProfile.ts     # 프로파일 캐시
│   │   │   ├── history.ts          # 생성 히스토리 CRUD
│   │   │   └── settings.ts         # electron-store + safeStorage wrapper
│   │   ├── images/
│   │   │   └── load.ts             # sharp 리사이즈 + base64
│   │   └── services/
│   │       ├── styleAnalyzer.ts    # 샘플 → 프로파일
│   │       └── postGenerator.ts    # 입력 → 결과
│   ├── preload/
│   │   └── index.ts                # contextBridge 노출
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts                  # window.api 타입 래퍼
│   │   ├── routes/
│   │   │   ├── Compose.tsx
│   │   │   ├── MyStyle.tsx
│   │   │   ├── History.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/             # 디자이너 마크업에서 추출
│   │   └── styles/
│   │       └── tokens.css          # 디자이너 토큰
│   └── shared/
│       └── types.ts                # main+renderer 공통 타입
├── tests/
│   ├── main/
│   │   ├── llm/                    # provider 테스트 (SDK 모킹)
│   │   ├── storage/                # in-memory SQLite로
│   │   └── services/
│   └── renderer/                   # 후순위 (디자이너 마크업 후)
├── design/                          # 디자이너 산출물 (HTML/CSS)
└── docs/
    ├── specs/
    ├── plans/
    └── design-brief.md
```

---

## 7. 데이터 모델

### 7.1 SQLite 스키마

```sql
CREATE TABLE samples (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE style_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL,         -- StyleProfile 직렬화
  source_hash TEXT NOT NULL,  -- 샘플 변경 감지
  sample_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  address TEXT,
  post_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hashtags TEXT NOT NULL,     -- JSON 배열
  image_map TEXT NOT NULL,    -- JSON 객체
  created_at TEXT NOT NULL
);
```

### 7.2 Settings (electron-store)

```ts
{
  provider: "claude" | "gemini",
  useWebSearch: boolean,
  hasApiKey: { claude: boolean; gemini: boolean },  // 키 자체는 별도(safeStorage)
}
```

키는 `safeStorage.encryptString(key)` 로 암호화하여 `<userData>/keys/claude.bin` 같은 파일로 저장.

### 7.3 공유 타입 (shared/types.ts 요약)

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

export interface StoreInfo {
  storeName: string;
  address: string;
  visitDate?: string;
  postType: PostType;
  title?: string;
  keywords: string[];          // max 5
  length: number;              // default 1500
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
  images: ImageInput[];        // max 10
  useWebSearch: boolean;
}

export interface GenerationResult {
  title: string;
  body: string;                // contains [사진1]~[사진N]
  hashtags: string[];
  imageMap: Record<string, string>;  // "사진1" -> filename
}

export interface HistoryRecord extends GenerationResult {
  id: string;
  storeName: string;
  address?: string;
  postType: PostType;
  createdAt: string;
}
```

---

## 8. LLM Provider 추상화

`src/main/llm/types.ts`:

```ts
export interface LLMProvider {
  name: Provider;
  supportsVision(): boolean;     // 둘 다 true
  supportsWebSearch(): boolean;  // 둘 다 true (각 SDK 방식 다름)

  validateApiKey(): Promise<boolean>;

  analyzeStyle(samples: string[]): Promise<Omit<StyleProfile, "sourceHash" | "sampleCount" | "updatedAt">>;

  generatePost(args: {
    profile: StyleProfile;
    input: GenerateInput;
    imageMarkers: string[];      // ["사진1", "사진2", ...]
  }): Promise<GenerationResult>;
}

export function getProvider(name: Provider, apiKey: string): LLMProvider;
```

각 구현(`claude.ts`, `gemini.ts`)은 자기 SDK를 호출하고 결과를 동일한 JSON 형태로 정규화하여 반환.

**프롬프트는 공통 (`prompts.ts`)**: 두 모델 모두 한국어 시스템 프롬프트를 받아 동일 구조의 JSON을 출력하도록 지시.

---

## 9. IPC API (preload → renderer)

```ts
// preload/index.ts 에서 contextBridge.exposeInMainWorld('api', ...)
declare global {
  interface Window {
    api: {
      settings: {
        get(): Promise<Settings & { hasApiKey: Record<Provider, boolean> }>;
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
      };
      generate: {
        run(input: GenerateInput): Promise<GenerationResult>;
        onProgress(cb: (stage: string) => void): () => void;
      };
      history: {
        list(): Promise<HistoryRecord[]>;
        get(id: string): Promise<HistoryRecord | null>;
        delete(id: string): Promise<void>;
      };
    };
  }
}
```

---

## 10. 사용자 흐름 (5개 화면)

1. **Settings** — provider 선택, API 키 입력 + 검증, 웹검색 토글
2. **My Style** — 샘플 글 추가/삭제, "분석 시작" → 프로파일 카드 표시
3. **Compose** — 입력 폼 작성 + 사진 업로드 → "글 만들기" → 결과 패널에 표시
4. **결과 (Compose 내부 상태)** — 제목/본문 편집, 해시태그 복사, 본문 복사, 사진 매핑 표
5. **History** — 과거 생성 결과 카드 리스트, 클릭하면 결과 패널로 열림

---

## 11. 에러 처리

| 상황 | 동작 |
|------|------|
| API 키 미설정 / 잘못된 키 | 분석/생성 시작 전 차단 + Settings로 유도 |
| 스타일 프로파일 없음 | Compose에서 차단 + My Style로 유도 |
| 샘플 5개 미만 | 경고 표시 후 분석 진행 (사용자 동의) |
| 이미지 10장 초과 | 앞 10장만 사용 + 경고 |
| 이미지 5MB 초과 | sharp로 자동 리사이즈 (1568px 긴변) |
| LLM JSON 파싱 실패 | 1회 재시도, 실패 시 원문 표시 + 에러 |
| 글자수 ±20% 벗어남 | 결과 패널 상단에 경고 배너 (재생성은 사용자 선택) |
| 마커 누락/잉여 | 결과 패널에 경고 배너 |
| 네트워크 오류 | 명확한 에러 메시지, 재시도 버튼 |

---

## 12. 빌드 & 배포

- **개발:** `npm run dev` (electron-vite의 hot reload)
- **테스트:** `npm test` (vitest)
- **빌드:**
  - Mac: `npm run build:mac` → `release/naver-blog-writer-<version>.dmg`
  - Windows: `npm run build:win` → `release/naver-blog-writer-<version>.exe` (NSIS)
- **서명:** v1에서는 미서명 빌드로 시작 (개인 전달용). 추후 Apple Developer ID / Windows code signing 추가 가능.
- **자동 업데이트:** v1에서 미포함.

---

## 13. 테스트 전략

- **유닛 (main 프로세스):**
  - `images/load.ts` — sharp 리사이즈/인코딩
  - `storage/*` — in-memory SQLite로 CRUD
  - `services/styleAnalyzer.ts` — Provider 모킹
  - `services/postGenerator.ts` — Provider 모킹, 마커/길이 검증
  - `llm/claude.ts`, `llm/gemini.ts` — SDK fetch 모킹
- **유닛 (렌더러):** 디자이너 마크업 통합 후 추가 (Compose 폼 검증, 결과 렌더링 등)
- **수동 스모크:** Mac/Windows 양쪽에서 빌드된 앱으로 한 사이클 실행

---

## 14. MVP 범위에서 제외

- 자동 포스팅 / 네이버 스마트에디터 자동화
- 다국어 (한국어만)
- 다크 모드
- 다중 사용자 / 클라우드 동기화
- 자동 업데이트
- 코드 서명 (당장은 unsigned 빌드 전달)

---

## 15. 예상 비용 (사용자가 자기 키 사용)

- **Claude (Haiku 4.5)** — 글 1편 ~$0.02, 월 30편 ~$0.6
- **Claude (Sonnet 4.6)** — 글 1편 ~$0.10, 월 30편 ~$3
- **Gemini 2.5 Flash** — 글 1편 ~$0.01, 월 30편 ~$0.3
- **+ 웹검색 활성화 시** — 1편당 ~$0.02 추가

사용자가 어떤 모델을 선택하든 월 $5 이내로 충분히 운영 가능.

---

## 16. 의존성 / 호환성

- Node.js 20 LTS (Electron 임베디드)
- Mac 10.15+ / Windows 10+
- 인터넷 연결 필수 (LLM 호출)
