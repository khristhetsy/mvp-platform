import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BUDGET, type BudgetConfig } from "./config";
import { DEFAULT_FOUNDER_PREFS, type FounderEmailPrefs } from "./prefs";
import { budgetBucket } from "./rules";

const state: {
  job: string | null;
  cfg: BudgetConfig;
  prefs: FounderEmailPrefs;
  profile: { id: string; email: string; role: string } | null;
  repeatCount: number;
  inserted: Array<Record<string, unknown>>;
  insertError: boolean;
} = { job: null, cfg: DEFAULT_BUDGET, prefs: DEFAULT_FOUNDER_PREFS, profile: null, repeatCount: 0, inserted: [], insertError: false };

vi.mock("@/lib/cron/job-context", () => ({ currentJob: () => (state.job ? { job: state.job, runId: 1 } : null) }));
vi.mock("./config", async (orig) => ({ ...(await orig<typeof import("./config")>()), loadBudgetConfig: async () => state.cfg }));
vi.mock("./prefs", async (orig) => ({ ...(await orig<typeof import("./prefs")>()), loadFounderPrefs: async () => state.prefs }));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ in: () => ({ limit: async () => ({ data: state.profile ? [state.profile] : [] }) }) }) };
      }
      return {
        select: () => {
          const chain = { eq: () => chain, gte: async () => ({ count: state.repeatCount }) };
          return chain;
        },
        insert: async (row: Record<string, unknown>) => {
          if (state.insertError) return { error: { message: "no table" } };
          state.inserted.push(row);
          return { error: null };
        },
      };
    },
  }),
}));

const { holdForFounderDigest } = await import("./gate");

function idWithBucketBelow(limit: number): string {
  for (let i = 0; ; i++) if (budgetBucket(`founder-${i}`) < limit) return `founder-${i}`;
}
function idWithBucketAtLeast(limit: number): string {
  for (let i = 0; ; i++) if (budgetBucket(`founder-${i}`) >= limit) return `founder-${i}`;
}

const email = { to: "ada@startup.com", subject: "Finish your data room", html: '<p>Two items left.</p><a href="https://icapos.com/founder/readiness">Open</a>' };

beforeEach(() => {
  state.job = "/api/cron/founder-nudges";
  state.cfg = { ...DEFAULT_BUDGET, rolloutPct: 50, holdoutPct: 10, rules: { ...DEFAULT_BUDGET.rules } };
  state.prefs = { ...DEFAULT_FOUNDER_PREFS };
  state.profile = { id: idWithBucketBelow(50), email: "ada@startup.com", role: "founder" };
  state.repeatCount = 0;
  state.inserted = [];
  state.insertError = false;
});

describe("holdForFounderDigest", () => {
  it("holds a founder nudge for a rollout founder and stores its preview", async () => {
    expect(await holdForFounderDigest(email)).toEqual({ action: "hold", reason: "Held for the founder's digest" });
    expect(state.inserted[0]).toMatchObject({ source_job: "/api/cron/founder-nudges", subject: "Finish your data room", excerpt: "Two items left. Open", url: "https://icapos.com/founder/readiness" });
  });

  it("sends as normal outside a founder job, at 0% rollout, and for holdout or control founders", async () => {
    state.job = null;
    expect(await holdForFounderDigest(email)).toBeNull();
    state.job = "/api/cron/meeting-reminders";
    expect(await holdForFounderDigest(email)).toBeNull();
    state.job = "/api/cron/founder-nudges";
    state.cfg = { ...state.cfg, rolloutPct: 0 };
    expect(await holdForFounderDigest(email)).toBeNull();
    state.cfg = { ...state.cfg, rolloutPct: 50 };
    state.profile = { id: idWithBucketAtLeast(90), email: "ada@startup.com", role: "founder" };
    expect(await holdForFounderDigest(email)).toBeNull();
    expect(state.inserted).toHaveLength(0);
  });

  it("never touches investors, staff, internal accounts or multi recipient mail", async () => {
    state.profile = { ...state.profile!, role: "investor" };
    expect(await holdForFounderDigest(email)).toBeNull();
    state.profile = { ...state.profile!, role: "founder", email: "khris@myicfos.com" };
    expect(await holdForFounderDigest(email)).toBeNull();
    state.profile = { ...state.profile!, email: "ada@startup.com" };
    expect(await holdForFounderDigest({ ...email, to: "ada@startup.com, bob@startup.com" })).toBeNull();
    expect(await holdForFounderDigest({ ...email, cc: "cfo@startup.com" })).toBeNull();
  });

  it("drops for instant only founders, including the weekly match email", async () => {
    state.prefs = { ...DEFAULT_FOUNDER_PREFS, mode: "instant" };
    expect(await holdForFounderDigest(email)).toMatchObject({ action: "drop" });
    state.job = "/api/cron/founder-match-digest";
    expect(await holdForFounderDigest(email)).toMatchObject({ action: "drop" });
    state.prefs = { ...DEFAULT_FOUNDER_PREFS, mode: "daily" };
    expect(await holdForFounderDigest(email)).toBeNull();
  });

  it("drops a reminder past the repeat limit", async () => {
    state.repeatCount = 3;
    expect(await holdForFounderDigest(email)).toMatchObject({ action: "drop" });
    state.cfg = { ...state.cfg, rules: { ...state.cfg.rules, repeatLimit: false } };
    expect(await holdForFounderDigest(email)).toMatchObject({ action: "hold" });
  });

  it("sends as normal when batching is off or the item cannot be stored", async () => {
    state.cfg = { ...state.cfg, rules: { ...state.cfg.rules, batchIntoDigest: false } };
    expect(await holdForFounderDigest(email)).toBeNull();
    state.cfg = { ...state.cfg, rules: { ...state.cfg.rules, batchIntoDigest: true } };
    state.insertError = true;
    expect(await holdForFounderDigest(email)).toBeNull();
  });
});
