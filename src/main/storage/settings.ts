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
};

const store = new Store<StoreSchema>({
  defaults: { provider: "claude", useWebSearch: false, customDataDir: null },
});

const DB_FILENAME = "naver-blog-writer.db";
const KEYS_DIRNAME = "keys";

function defaultDataDir(): string {
  return app.getPath("userData");
}

export function getDataDir(): string {
  const custom = store.get("customDataDir");
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
    provider: store.get("provider"),
    useWebSearch: store.get("useWebSearch"),
    hasApiKey: {
      claude: claudeKey !== null,
      gemini: geminiKey !== null,
    },
    apiKeyMasked: {
      claude: maskApiKey(claudeKey),
      gemini: maskApiKey(geminiKey),
    },
  };
}

export function setProvider(p: Provider): void {
  assertProvider(p);
  store.set("provider", p);
}

export function setWebSearch(on: boolean): void {
  store.set("useWebSearch", on);
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
  if (existsSync(dbFrom)) {
    cpSync(dbFrom, dbTo, { force: true });
  }
  const keysFrom = join(from, KEYS_DIRNAME);
  const keysTo = join(to, KEYS_DIRNAME);
  if (existsSync(keysFrom)) {
    cpSync(keysFrom, keysTo, { recursive: true, force: true });
  }
}

function cleanupOldData(dir: string): void {
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

export function setCustomDataDir(newPath: string | null): { moved: boolean } {
  const currentDir = getDataDir();

  if (newPath === null) {
    const fallback = defaultDataDir();
    if (resolve(currentDir) === resolve(fallback)) {
      store.set("customDataDir", null);
      return { moved: false };
    }
    ensureWritableDirectory(fallback);
    copyDataFiles(currentDir, fallback);
    store.set("customDataDir", null);
    cleanupOldData(currentDir);
    return { moved: true };
  }

  if (typeof newPath !== "string" || newPath.length === 0) {
    throw new Error("경로가 비어 있습니다.");
  }
  if (!isAbsolute(newPath)) {
    throw new Error("절대 경로를 입력해주세요.");
  }
  const resolvedNew = resolve(newPath);
  if (resolve(currentDir) === resolvedNew) {
    return { moved: false };
  }
  ensureWritableDirectory(resolvedNew);
  copyDataFiles(currentDir, resolvedNew);
  store.set("customDataDir", resolvedNew);
  cleanupOldData(currentDir);
  return { moved: true };
}
