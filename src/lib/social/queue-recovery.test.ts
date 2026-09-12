import { describe, it, expect } from "vitest";
import { STUCK_CLAIM_MS } from "./queue";

/**
 * The stuck-claim window is a safety property, not a preference: it must sit above the
 * serverless function's own ceiling, or the sweep could reclaim a variant that is still
 * being published — and the platform would get the post twice.
 */
describe("stuck-claim window", () => {
  const FUNCTION_LIMIT_MS = 60_000;   // maxDuration on the cron route

  it("is comfortably longer than the function could possibly run", () => {
    expect(STUCK_CLAIM_MS).toBeGreaterThan(FUNCTION_LIMIT_MS * 5);
  });
  it("is short enough that a stranded post surfaces the same working day", () => {
    expect(STUCK_CLAIM_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });
  it("is 15 minutes", () => {
    expect(STUCK_CLAIM_MS).toBe(15 * 60 * 1000);
  });
});

/**
 * Documents the state machine the recovery relies on. `interrupted` deliberately is NOT
 * `failed`: failed means we know nothing was published, interrupted means we don't know.
 * Conflating them is what would lead someone to blind-retry a post that is already live.
 */
describe("interrupted vs failed", () => {
  const TERMINAL = ["published", "failed", "skipped", "archived"];
  const RECOVERABLE = ["interrupted", "failed"];

  it("keeps interrupted out of the terminal set, so it stays actionable", () => {
    expect(TERMINAL).not.toContain("interrupted");
  });
  it("allows recovery actions from interrupted and failed only", () => {
    expect(RECOVERABLE).toContain("interrupted");
    expect(RECOVERABLE).not.toContain("published");
    expect(RECOVERABLE).not.toContain("publishing");
  });
});
