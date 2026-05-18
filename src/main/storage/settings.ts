import { app, safeStorage } from "electron";
import Store from "electron-store";
import {
  mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync,
  cpSync, statSync, rmSync, accessSync, constants as fsConstants,
} from "fs";
import { isAbsolute, join, resolve } from "path";
import type { Provider, SettingsWithKeyStatus } from "@shared/types";

const VALID_PROVIDERS: ReadonlySet<Provider> = new Set(["claude", "gemini"]);

export function isValidProvider(p: unknown): p is Provider {
  return typeof p === "string" && VALID_PROVIDERS.has(p as Provider);
}

function assertProvider(p: unknown): asserts p is Provider {
  if (!isValidProvider(p)) {
    throw new Error(`Invalid provider: ${String(p)}`);
  }
}

type StoreSchema = {
  provider: Provider;
  useWebSearch: boolean;
  customDataDir: string | null;
  models: { claude: string; gemini: string };
  defaultPostType?: string;
  defaultLength?: number;
  defaultTone?: string;
};

const DEFAULT_MODELS = {
  claude: "claude-haiku-4-5-20251001",
  gemini: "gemini-3.1-flash-lite",
} as const;

let storeInstance: Store<StoreSchema> | null = null;

function getStore(): Store<StoreSchema> {
  if (!storeInstance) {
    storeInstance = new Store<StoreSchema>({
      defaults: {
        provider: "claude",
        useWebSearch: false,
        customDataDir: null,
        models: { ...DEFAULT_MODELS },
        defaultPostType: "맛집",
        defaultLength: 1500,
        defaultTone: "my_style",
      },
    });
  }
  return storeInstance;
}

const DB_FILENAME = "naver-blog-writer.db";
const KEYS_DIRNAME = "keys";

function defaultDataDir(): string {
  return app.getPath("userData");
}

export function getDataDir(): string {
  const custom = getStore().get("customDataDir");
  if (typeof custom === "string" && custom.length > 0) {
    return custom;
  }
  return defaultDataDir();
}

export function getDbPath(): string {
  return join(getDataDir(), DB_FILENAME);
}

function keysDir(): string {
  const dir = join(getDataDir(), KEYS_DIRNAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function keyPath(p: Provider): string {
  assertProvider(p);
  return join(keysDir(), `${p}.bin`);
}

function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(8)}${key.slice(-4)}`;
}

function safeGetApiKey(p: Provider): string | null {
  try {
    return getApiKey(p);
  } catch {
    return null;
  }
}

export function getSettings(): SettingsWithKeyStatus {
  const claudeKey = safeGetApiKey("claude");
  const geminiKey = safeGetApiKey("gemini");
  return {
    provider: getStore().get("provider"),
    useWebSearch: getStore().get("useWebSearch"),
    defaultPostType: getStore().get("defaultPostType") as any,
    defaultLength: getStore().get("defaultLength"),
    defaultTone: getStore().get("defaultTone") as any,
    hasApiKey: {
      claude: claudeKey !== null,
      gemini: geminiKey !== null,
    },
    apiKeyMasked: {
      claude: maskApiKey(claudeKey),
      gemini: maskApiKey(geminiKey),
    },
    models: getStore().get("models") || { ...DEFAULT_MODELS },
  };
}

export function getModel(p: Provider): string {
  assertProvider(p);
  const models = getStore().get("models") || { ...DEFAULT_MODELS };
  return models[p] || DEFAULT_MODELS[p];
}

export function setModel(p: Provider, model: string): void {
  assertProvider(p);
  const trimmed = (model ?? "").trim();
  if (!trimmed) throw new Error("모델 이름이 비어 있습니다.");
  const current = getStore().get("models") || { ...DEFAULT_MODELS };
  getStore().set("models", { ...current, [p]: trimmed });
}

export function setProvider(p: Provider): void {
  assertProvider(p);
  getStore().set("provider", p);
}

export function setWebSearch(on: boolean): void {
  getStore().set("useWebSearch", on);
}

export function setDefaultValues(type: string, len: number, tone: string): void {
  getStore().set("defaultPostType", type);
  getStore().set("defaultLength", len);
  getStore().set("defaultTone", tone);
}

export function setApiKey(p: Provider, key: string): void {
  assertProvider(p);
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS 보안 저장소를 사용할 수 없습니다.");
  }
  const enc = safeStorage.encryptString(key);
  writeFileSync(keyPath(p), enc);
}

export function getApiKey(p: Provider): string | null {
  assertProvider(p);
  const path = keyPath(p);
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return safeStorage.decryptString(buf);
}

export function clearApiKey(p: Provider): void {
  assertProvider(p);
  const path = keyPath(p);
  if (existsSync(path)) unlinkSync(path);
}

// ============ Custom data directory ============

function ensureWritableDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true });
  let stat;
  try {
    stat = statSync(dir);
  } catch (e) {
    throw new Error(`폴더에 접근할 수 없습니다: ${(e as Error).message}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`경로가 폴더가 아닙니다: ${dir}`);
  }
  try {
    accessSync(dir, fsConstants.W_OK);
  } catch {
    throw new Error(`폴더에 쓰기 권한이 없습니다: ${dir}`);
  }
}

function copyDataFiles(from: string, to: string): void {
  const dbFrom = join(from, DB_FILENAME);
  const dbTo = join(to, DB_FILENAME);
  const keysFrom = join(from, KEYS_DIRNAME);
  const keysTo = join(to, KEYS_DIRNAME);
  let dbCopied = false;
  try {
    if (existsSync(dbFrom)) {
      cpSync(dbFrom, dbTo, { force: true });
      dbCopied = true;
    }
    if (existsSync(keysFrom)) {
      cpSync(keysFrom, keysTo, { recursive: true, force: true });
    }
  } catch (e) {
    // Rollback DB if keys copy fails — avoid leaving a half-migrated target.
    if (dbCopied && existsSync(dbTo)) {
      try { unlinkSync(dbTo); } catch (cleanupErr) {
        console.warn("rollback dbTo failed", cleanupErr);
      }
    }
    throw e;
  }
}

export function cleanupOldDataDir(dir: string): void {
  const dbPath = join(dir, DB_FILENAME);
  if (existsSync(dbPath)) {
    try { unlinkSync(dbPath); } catch (e) { console.warn("cleanup db failed", e); }
  }
  const keysPath = join(dir, KEYS_DIRNAME);
  if (existsSync(keysPath)) {
    try { rmSync(keysPath, { recursive: true, force: true }); }
    catch (e) { console.warn("cleanup keys failed", e); }
  }
}

/**
 * Move data dir. Does NOT delete old data — that must happen *after* the
 * caller has closed the DB connection on the old path. Returns the previous
 * directory so callers can pass it to {@link cleanupOldDataDir}.
 */
export function setCustomDataDir(newPath: string | null): {
  moved: boolean;
  oldDir: string;
} {
  const currentDir = getDataDir();

  if (newPath === null) {
    const fallback = defaultDataDir();
    if (resolve(currentDir) === resolve(fallback)) {
      getStore().set("customDataDir", null);
      return { moved: false, oldDir: currentDir };
    }
    ensureWritableDirectory(fallback);
    copyDataFiles(currentDir, fallback);
    getStore().set("customDataDir", null);
    return { moved: true, oldDir: currentDir };
  }

  if (typeof newPath !== "string" || newPath.length === 0) {
    throw new Error("경로가 비어 있습니다.");
  }
  if (!isAbsolute(newPath)) {
    throw new Error("절대 경로를 입력해주세요.");
  }
  const resolvedNew = resolve(newPath);
  if (resolve(currentDir) === resolvedNew) {
    return { moved: false, oldDir: currentDir };
  }
  ensureWritableDirectory(resolvedNew);
  copyDataFiles(currentDir, resolvedNew);
  getStore().set("customDataDir", resolvedNew);
  return { moved: true, oldDir: currentDir };
}
