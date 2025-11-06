import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/globalConfig.js"],
    setupFiles: ["./tests/setupQueue.js"],
    sequence: { concurrent: false },
    pool: "threads",
  },
});
