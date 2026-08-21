import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Unit tests only — no database, no network. The eval harness (evals/) is
    // the integration surface and runs separately via `pnpm eval`.
    include: ["src/**/*.test.ts", "packages/*/src/**/*.test.ts"],
  },
});
