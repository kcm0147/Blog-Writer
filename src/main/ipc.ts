import { ipcMain, BrowserWindow } from "electron";
import {
  getSettings, setProvider, setWebSearch, setApiKey, clearApiKey, getApiKey,
  isValidProvider,
} from "./storage/settings";
import { addSample, listSamples, deleteSample } from "./storage/samples";
import { loadProfile } from "./storage/styleProfile";
import { listHistory, getHistory, deleteHistory } from "./storage/history";
import { runAnalyze } from "./services/styleAnalyzer";
import { runGenerate } from "./services/postGenerator";
import { makeProvider } from "./llm";
import { getDb } from "./db-singleton";
import { prepareImage } from "./images/load";
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
    if (!isValidProvider(p)) throw new Error(`Invalid provider: ${String(p)}`);
    const key = getApiKey(p);
    if (!key) return false;
    return await makeProvider(p, key).validateApiKey();
  });

  ipcMain.handle("images:prepare", (_e, filename: string, data: number[]) =>
    prepareImage(filename, Buffer.from(data)),
  );

  ipcMain.handle("samples:list", () => listSamples(getDb()));
  ipcMain.handle("samples:add", (_e, input: { label: string; body: string }) =>
    addSample(getDb(), input),
  );
  ipcMain.handle("samples:delete", (_e, id: string) => deleteSample(getDb(), id));

  ipcMain.handle("style:getProfile", () => loadProfile(getDb()));
  ipcMain.handle("style:analyze", async () => {
    const { provider } = getSettings();
    if (!isValidProvider(provider)) throw new Error(`Invalid provider: ${String(provider)}`);
    const key = requireApiKey(provider);
    return runAnalyze(getDb(), makeProvider(provider, key), {
      onProgress: (s) => emitProgress("style:progress", s),
      onWarning: (w) => emitProgress("style:warning", w),
    });
  });

  ipcMain.handle("generate:run", async (_e, input: GenerateInput) => {
    const { provider } = getSettings();
    if (!isValidProvider(provider)) throw new Error(`Invalid provider: ${String(provider)}`);
    const key = requireApiKey(provider);
    return runGenerate(getDb(), makeProvider(provider, key), input, {
      onProgress: (s) => emitProgress("generate:progress", s),
    });
  });

  ipcMain.handle("history:list", () => listHistory(getDb()));
  ipcMain.handle("history:get", (_e, id: string) => getHistory(getDb(), id));
  ipcMain.handle("history:delete", (_e, id: string) => deleteHistory(getDb(), id));
}
