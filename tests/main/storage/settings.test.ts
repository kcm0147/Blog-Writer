import { describe, it, expect, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

vi.mock("electron", () => {
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), "nbw-test-"));
  const electronMock = {
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (s: string) => Buffer.from(s, "utf-8"),
      decryptString: (b: Buffer) => b.toString("utf-8"),
    },
    app: {
      getPath: () => tmpUserData,
      getVersion: () => "0.0.0-test",
    },
    ipcMain: { on: () => {} },
    shell: {},
  };
  return { ...electronMock, default: electronMock };
});

import {
  getSettings, setProvider, setWebSearch, setApiKey, clearApiKey, getApiKey,
  getModel, setModel,
} from "@main/storage/settings";

describe("settings", () => {
  it("default settings: claude provider, web search off", () => {
    const s = getSettings();
    expect(s.provider).toBe("claude");
    expect(s.useWebSearch).toBe(false);
    expect(s.hasApiKey.claude).toBe(false);
    expect(s.hasApiKey.gemini).toBe(false);
    expect(s.models.claude).toBe("claude-haiku-4-5-20251001");
    expect(s.models.gemini).toBe("gemini-1.5-flash");
  });

  it("set+get model per provider", () => {
    setModel("claude", "claude-sonnet-4-5");
    setModel("gemini", "gemini-2.0-flash");
    expect(getModel("claude")).toBe("claude-sonnet-4-5");
    expect(getModel("gemini")).toBe("gemini-2.0-flash");
    const s = getSettings();
    expect(s.models.claude).toBe("claude-sonnet-4-5");
    expect(s.models.gemini).toBe("gemini-2.0-flash");
  });

  it("setModel rejects empty values", () => {
    expect(() => setModel("claude", "   ")).toThrow();
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
