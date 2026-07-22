import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests need a live Postgres and run in their own config/CI job.
    // Keep them out of the default (unit) run so `npm test` needs no database.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
