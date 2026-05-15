import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    server: {
      deps: {
        inline: ["electron-store", "conf"],
      },
    },
  },
  resolve: {
    alias: {
      "@shared": resolve("src/shared"),
      "@main": resolve("src/main"),
      "@renderer": resolve("src/renderer"),
    },
  },
});
