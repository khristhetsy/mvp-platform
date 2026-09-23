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
      // A leading underscore marks an intentionally-unused binding (interface-
      // required params on adapter stubs, deliberately-ignored destructures).
      // Treat those as intentional rather than flagging them.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
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
