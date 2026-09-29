import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // See src/test/server-only-stub.ts — the real package throws outside Next's RSC runtime.
    alias: { "server-only": decodeURIComponent(new URL("./src/test/server-only-stub.ts", import.meta.url).pathname) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests need a live Postgres and run in their own config/CI job.
    // Keep them out of the default (unit) run so `npm test` needs no database.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
