import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(raiz, "src"),
      "next/font/local": path.resolve(raiz, "tests/fixtures/next-font-local.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup-vitest.ts"],
    exclude: [".claude/**", "tests/e2e/**", "tests/fixtures/**", "node_modules/**"],
  },
});
