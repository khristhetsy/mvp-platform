import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration tests run against a REAL Postgres with all migrations applied
// (see .github/workflows/integration.yml). They assert the schema invariants
// the money and compliance code depend on — RLS being enabled, unique
// constraints existing, critical columns present — which a static read of the
// migration files cannot reliably determine.
//
// Run locally with a Supabase stack:
//   supabase start
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres \
//     npm run test:integration
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // Integration tests must never be silently skipped — fail loudly if the
    // suite is empty (e.g. a bad glob) so a green run always means real coverage.
    passWithNoTests: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
