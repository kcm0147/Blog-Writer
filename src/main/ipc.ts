import { ipcMain, BrowserWindow, dialog } from "electron";
import {
  getSettings, setProvider, setWebSearch, setApiKey, clearApiKey, getApiKey,
  isValidProvider, getDataDir, setCustomDataDir, cleanupOldDataDir,
  getModel, setModel,
} from "./storage/settings";
import { resolve } from "path";
import {
  addSample, listSamples, deleteSample, updateSample, setSampleHtml,
  getSampleHtml,
} from "./storage/samples";
import { scrapeNaverBlog } from "./scrapers/naverBlog";
import { loadProfile } from "./storage/styleProfile";
import { listHistory, getHistory, deleteHistory } from "./storage/history";
import { runAnalyze } from "./services/styleAnalyzer";
import { runGenerate } from "./services/postGenerator";
import { makeProvider } from "./llm";
import { toUserMessage } from "./llm/errors";
import { getDb, reopenDb } from "./db-singleton";
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

function requireId(id: unknown, label: string): string {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error(`${label} ID가 비어 있습니다.`);
  }
  return id;
}

export function registerIpc(): void {
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:setProvider", (_e, p: Provider) => setProvider(p));
  ipcMain.handle("settings:setWebSearch", (_e, on: boolean) => setWebSearch(on));
  ipcMain.handle("settings:setApiKey", (_e, p: Provider, key: string) => setApiKey(p, key));
  ipcMain.handle("settings:clearApiKey", (_e, p: Provider) => clearApiKey(p));
  ipcMain.handle("settings:setModel", (_e, p: Provider, model: string) => {
    if (!isValidProvider(p)) throw new Error(`Invalid provider: ${String(p)}`);
    setModel(p, model);
  });
  ipcMain.handle("settings:validateApiKey", async (_e, p: Provider) => {
    if (!isValidProvider(p)) return { ok: false, message: "Invalid provider" };
    const key = getApiKey(p);
    if (!key) return { ok: false, message: "API 키가 등록되어 있지 않습니다." };
    try {
      const model = getModel(p);
      const ok = await makeProvider(p, key, model).validateApiKey();
      return ok
        ? { ok: true }
        : { ok: false, message: "키가 유효하지 않습니다. 다시 확인해주세요." };
    } catch (e) {
      console.error("validateApiKey error", e);
      return { ok: false, message: toUserMessage(e) };
    }
  });

  ipcMain.handle("settings:getDataDir", () => getDataDir());
  ipcMain.handle("settings:setDataDir", async (_e, newPath: string | null) => {
    try {
      // 1. Copy data to new dir & flip the pointer in the store.
      //    Does NOT delete old data yet — the DB connection still holds it.
      const { moved, oldDir } = setCustomDataDir(newPath);
      // 2. Close old connection, open against the new path. After this we
      //    own no file handles in oldDir.
      reopenDb();
      // 3. Now it's safe to remove the old data files (only if we actually
      //    moved to a different directory).
      if (moved && resolve(oldDir) !== resolve(getDataDir())) {
        cleanupOldDataDir(oldDir);
      }
      return { ok: true, moved };
    } catch (e) {
      console.error("settings:setDataDir failed", e);
      throw new Error((e as Error).message);
    }
  });

  ipcMain.handle("dialog:pickFolder", async () => {
    const win = BrowserWindow.getFocusedWindow()
      ?? BrowserWindow.getAllWindows()[0];
    if (!win) return null;
    const res = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "데이터 저장 폴더 선택",
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
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
    (_e, input: { id: string; label?: string; body?: string }) => {
      requireId(input?.id, "샘플");
      return updateSample(getDb(), input);
    },
  );
  ipcMain.handle("samples:delete", (_e, id: string) =>
    deleteSample(getDb(), requireId(id, "샘플")),
  );
  ipcMain.handle("samples:getHtml", (_e, id: string) =>
    getSampleHtml(getDb(), requireId(id, "샘플")),
  );

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
        const existing = new Set(listSamples(db).map((s) => s.label));
        const inserted: { id: string; label: string }[] = [];
        let skipped = 0;
        for (const post of posts) {
          if (existing.has(post.title)) {
            skipped++;
            continue;
          }
          const s = addSample(db, { label: post.title, body: post.body });
          if (post.bodyHtml) setSampleHtml(db, s.id, post.bodyHtml);
          inserted.push({ id: s.id, label: s.label });
          existing.add(post.title);
        }
        return { count: inserted.length, skipped, samples: inserted };
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
      const model = getModel(provider);
      return await runAnalyze(getDb(), makeProvider(provider, key, model), {
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
      const model = getModel(provider);
      return await runGenerate(getDb(), makeProvider(provider, key, model), input, {
        onProgress: (s) => emitProgress("generate:progress", s),
      });
    } catch (e) {
      console.error("generate:run error", e);
      throw new Error(toUserMessage(e));
    }
  });

  ipcMain.handle("history:list", () => listHistory(getDb()));
  ipcMain.handle("history:get", (_e, id: string) =>
    getHistory(getDb(), requireId(id, "히스토리")),
  );
  ipcMain.handle("history:delete", (_e, id: string) =>
    deleteHistory(getDb(), requireId(id, "히스토리")),
  );
}
