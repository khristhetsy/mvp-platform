import { describe, expect, it, vi, beforeEach } from "vitest";

const state = { budget: 10 as number | null, spent: 0 as number | null, inserts: [] as unknown[] };

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "ai_budgets" && state.budget != null ? { data: { monthly_usd: state.budget }, error: null } : { data: null, error: null },
        }),
      }),
      insert: async (row: unknown) => {
        state.inserts.push(row);
        return { error: null };
      },
    }),
    rpc: async () => (state.spent == null ? { data: null, error: { message: "missing" } } : { data: state.spent, error: null }),
  }),
}));

import { assertAiBudget, isAiBudgetExceeded, recordAiSpend } from "./service";
import { anthropicCostUsd } from "./config";

beforeEach(() => {
  state.budget = 10;
  state.spent = 0;
  state.inserts = [];
});

describe("anthropicCostUsd", () => {
  it("prices Sonnet and Haiku per million tokens", () => {
    expect(anthropicCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBe(18);
    expect(anthropicCostUsd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000)).toBe(6);
  });
  it("bills an unknown model at the Sonnet rate", () => {
    expect(anthropicCostUsd("some-new-model", 0, 8192)).toBeCloseTo(0.12288, 5);
  });
});

describe("assertAiBudget", () => {
  it("allows a call that fits in the remaining budget", async () => {
    state.spent = 9.5;
    await expect(assertAiBudget("founder", 0.4)).resolves.toBeUndefined();
  });
  it("blocks when spend plus the reserve passes the budget", async () => {
    state.spent = 9.9;
    const err = await assertAiBudget("founder", 0.2).catch((e) => e);
    expect(isAiBudgetExceeded(err)).toBe(true);
  });
  it("never blocks when the budget tables can't be read", async () => {
    state.spent = null;
    await expect(assertAiBudget("founder", 999)).resolves.toBeUndefined();
    state.spent = 0;
    state.budget = null;
    await expect(assertAiBudget("founder", 999)).resolves.toBeUndefined();
  });
});

describe("recordAiSpend", () => {
  it("writes one row with the cost rounded to six decimals", async () => {
    await recordAiSpend({ vendor: "anthropic", category: "internal", feature: "untagged", costUsd: 0.0000004 + 0.0123456789 });
    expect(state.inserts).toHaveLength(1);
    expect((state.inserts[0] as { cost_usd: number }).cost_usd).toBe(0.012346);
  });
});
