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
    // Supabase CLI scratch. Nothing here is ours — the project talks to
    // Supabase through DATABASE_URL and drizzle migrations, not the CLI, so
    // this is leftover generated code and linting it means 150 errors in files
    // nobody wrote.
    "supabase/**",
  ]),
]);

export default eslintConfig;
