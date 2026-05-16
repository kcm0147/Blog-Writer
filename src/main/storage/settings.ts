import { app, safeStorage } from "electron";
import Store from "electron-store";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
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
