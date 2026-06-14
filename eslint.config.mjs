import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    ".venv/**",
    "__pycache__/**",
    ".ruff_cache/**",
    "data/**",
    "rag-pipeline/**",
    ".scratch/**",
    ".sisyphus/run-continuation/**",
  ]),
]);

export default eslintConfig;
