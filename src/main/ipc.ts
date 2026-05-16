import { ipcMain, BrowserWindow } from "electron";
import {
  getSettings, setProvider, setWebSearch, setApiKey, clearApiKey, getApiKey,
  isValidProvider,
} from "./storage/settings";
import {
  addSample, listSamples, deleteSample, updateSample, setSampleHtml,
} from "./storage/samples";
import { scrapeNaverBlog } from "./scrapers/naverBlog";
import { loadProfile } from "./storage/styleProfile";
import { listHistory, getHistory, deleteHistory } from "./storage/history";
import { runAnalyze } from "./services/styleAnalyzer";
import { runGenerate } from "./services/postGenerator";
import { makeProvider } from "./llm";
import { toUserMessage } from "./llm/errors";
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
    if (!isValidProvider(p)) return { ok: false, message: "Invalid provider" };
    const key = getApiKey(p);
    if (!key) return { ok: false, message: "API 키가 등록되어 있지 않습니다." };
    try {
      const ok = await makeProvider(p, key).validateApiKey();
      return ok
        ? { ok: true }
        : { ok: false, message: "키가 유효하지 않습니다. 다시 확인해주세요." };
    } catch (e) {
      console.error("validateApiKey error", e);
      return { ok: false, message: toUserMessage(e) };
    }
  });

  ipcMain.handle("images:prepare", (_e, filename: string, data: number[]) =>
    prepareImage(filename, Buffer.from(data)),
  );

  ipcMain.handle("samples:list", () => listSamples(getDb()));
  ipcMain.handle("samples:add", (_e, input: { label: string; body: string }) =>
    addSample(getDb(), input),
  );
  ipcMain.handle(
    "samples:update",
    (_e, input: { id: string; label?: string; body?: string }) =>
      updateSample(getDb(), input),
  );
  ipcMain.handle("samples:delete", (_e, id: string) => deleteSample(getDb(), id));

  ipcMain.handle(
    "samples:importFromNaver",
    async (_e, args: { input: string; limit: number }) => {
      try {
        const posts = await scrapeNaverBlog(args.input, args.limit, (p) => {
          for (const w of BrowserWindow.getAllWindows()) {
            w.webContents.send("samples:import-progress", p);
          }
        });
        const db = getDb();
        const inserted: { id: string; label: string }[] = [];
        for (const post of posts) {
          const s = addSample(db, { label: post.title, body: post.body });
          if (post.bodyHtml) setSampleHtml(db, s.id, post.bodyHtml);
          inserted.push({ id: s.id, label: s.label });
        }
        return { count: inserted.length, samples: inserted };
      } catch (e) {
        console.error("importFromNaver failed", e);
        throw new Error(toUserMessage(e));
      }
    },
  );

  ipcMain.handle("style:getProfile", () => loadProfile(getDb()));
  ipcMain.handle("style:analyze", async () => {
    try {
      const { provider } = getSettings();
      if (!isValidProvider(provider)) throw new Error(`Invalid provider: ${String(provider)}`);
      const key = requireApiKey(provider);
      return await runAnalyze(getDb(), makeProvider(provider, key), {
        onProgress: (s) => emitProgress("style:progress", s),
        onWarning: (w) => emitProgress("style:warning", w),
      });
    } catch (e) {
      console.error("style:analyze error", e);
      throw new Error(toUserMessage(e));
    }
  });

  ipcMain.handle("generate:run", async (_e, input: GenerateInput) => {
    try {
      const { provider } = getSettings();
      if (!isValidProvider(provider)) throw new Error(`Invalid provider: ${String(provider)}`);
      const key = requireApiKey(provider);
      return await runGenerate(getDb(), makeProvider(provider, key), input, {
        onProgress: (s) => emitProgress("generate:progress", s),
      });
    } catch (e) {
      console.error("generate:run error", e);
      throw new Error(toUserMessage(e));
    }
  });

  ipcMain.handle("history:list", () => listHistory(getDb()));
  ipcMain.handle("history:get", (_e, id: string) => getHistory(getDb(), id));
  ipcMain.handle("history:delete", (_e, id: string) => deleteHistory(getDb(), id));
}
