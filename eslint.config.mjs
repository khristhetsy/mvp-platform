import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Warn (don't fail the build) when a <button> omits an explicit type. React
  // defaults buttons to type="submit", which can accidentally submit a form.
  // New code must declare type; the existing 590+ are flagged as warnings to fix over time.
  {
    rules: {
      "react/button-has-type": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "backups/**",
  ]),
]);

export default eslintConfig;
