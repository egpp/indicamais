import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import boundariesConfig from "./eslint.boundaries.mjs";

// Fronteiras entre modulos (IM-001, IM-002): ver eslint.boundaries.mjs.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundariesConfig,
  prettier,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "cloudflare-env.d.ts",
    // Fixtures violam a regra de proposito; sao lintadas so pelo teste.
    "tests/fixtures/**",
  ]),
]);

export default eslintConfig;
