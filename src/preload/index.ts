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
  images: {
    prepare: (filename, data) =>
      ipcRenderer.invoke("images:prepare", filename, Array.from(data)),
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
