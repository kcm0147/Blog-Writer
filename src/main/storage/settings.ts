import { app, safeStorage } from "electron";
import Store from "electron-store";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import type { Provider, SettingsWithKeyStatus } from "@shared/types";

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
