import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      uuid: resolve(__dirname, "tests/esm-workaround/uuid-esm.js"),
      "ansi-styles": resolve(
        __dirname,
        "tests/esm-workaround/ansi-styles-esm.js"
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    sequence: { concurrent: false },
    pool: "threads",
    server: {
      deps: {
        inline: [/^(?!.*validators)/],
        external: [/validators/],
      },
    },
  },
});
