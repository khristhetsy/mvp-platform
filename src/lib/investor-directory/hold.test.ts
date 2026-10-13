import { describe, expect, it } from "vitest";
import { decideAdd, decideSplitImport, holdStatus } from "@/lib/investor-directory/limits";
import { DEFAULT_SETTINGS, FREE_TIER, type FounderDirectoryAccess } from "@/lib/investor-directory/types";

const plans = [
  { label: "Free", contacts: 0 },
  { label: "Basic", contacts: 100 },
  { label: "Professional", contacts: 1000 },
  { label: "Premium", contacts: 10000 },
];

describe("holdStatus", () => {
  it("works out what is left and the next plan up", () => {
    expect(holdStatus({ held: 63, max: 100, planLabel: "Basic", enforced: true, plans })).toEqual({
      held: 63, max: 100, left: 37, planLabel: "Basic", enforced: true, nextPlan: { label: "Professional", contacts: 1000 },
    });
  });
  it("has no next plan on Premium", () => {
    expect(holdStatus({ held: 5, max: 10000, planLabel: "Premium", enforced: true, plans }).nextPlan).toBeNull();
  });
  it("never goes below zero left", () => {
    expect(holdStatus({ held: 140, max: 100, planLabel: "Basic", enforced: true, plans }).left).toBe(0);
  });
});

describe("decideAdd", () => {
  const basic = (held: number) => holdStatus({ held, max: 100, planLabel: "Basic", enforced: true, plans });
  it("lets everything in when it fits", () => {
    expect(decideAdd(10, basic(63))).toEqual({ ok: true, allowed: 10 });
  });
  it("takes only what fits", () => {
    expect(decideAdd(108, basic(63))).toEqual({ ok: true, allowed: 37 });
  });
  it("refuses at the limit and names the next plan", () => {
    const d = decideAdd(1, basic(100));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.message).toBe("You hold 100 of 100 investors on Basic, the most your plan allows. Archive investors you no longer need. Or move to Professional for up to 1,000.");
  });
  it("refuses on Free", () => {
    const d = decideAdd(1, holdStatus({ held: 0, max: 0, planLabel: "Free", enforced: true, plans }));
    expect(d.ok).toBe(false);
  });
  it("lets everything in when the admin turned blocking off", () => {
    expect(decideAdd(500, holdStatus({ held: 100, max: 100, planLabel: "Basic", enforced: false, plans }))).toEqual({ ok: true, allowed: 500 });
  });
});


const access = (held: number, contacts = 100): FounderDirectoryAccess => ({
  tier: FREE_TIER,
  limits: {
    plan: "founder_basic", planLabel: "Basic",
    allowance: { plan_type: "founder_basic", label: "Basic", contacts, emails_per_month: 1000, sort: 1 },
    topUp: FREE_TIER, contacts, emails: 1000, emailsUsed: 0, periodStart: "x", periodEnd: "y",
  },
  status: "active", statusReason: null, termsAccepted: true, termsAcceptedAt: "x", held, formdUncounted: 0, importedToday: 0,
});
const settings = { ...DEFAULT_SETTINGS, require_terms: false, daily_cap: 1000, block_over_limit: true };

describe("decideSplitImport", () => {
  it("lets Form D firms in when the limit is full", () => {
    const d = decideSplitImport(["f1", "f2", "a"], new Set(["f1", "f2"]), access(100), settings);
    expect(d).toMatchObject({ ok: true, ids: ["f1", "f2"], limit: 2, trimmedBy: "hold_limit" });
  });
  it("counts only the others against the limit", () => {
    const d = decideSplitImport(["a", "f1", "b", "c"], new Set(["f1"]), access(98), settings);
    expect(d).toMatchObject({ ok: true, ids: ["f1", "a", "b"], limit: 3, trimmedBy: "hold_limit" });
  });
  it("refuses when the limit is full and nothing is Form D", () => {
    expect(decideSplitImport(["a"], new Set(), access(100), settings).ok).toBe(false);
  });
  it("keeps Form D closed on Free", () => {
    expect(decideSplitImport(["f1"], new Set(["f1"]), access(0, 0), settings).ok).toBe(false);
  });
});
