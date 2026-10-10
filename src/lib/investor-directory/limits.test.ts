import { describe, expect, it } from "vitest";
import { bounceRate, decideImport, startOfTodayPT, usageFlag } from "@/lib/investor-directory/limits";
import { DEFAULT_SETTINGS, type FounderDirectoryAccess } from "@/lib/investor-directory/types";

const tier = (hold: number) => ({ key: "t", label: "T", hold_limit: hold, email_limit: hold * 2, show_email: true, can_export: false, price_cents: null, sort: 1 });
const lim = (contacts: number) => ({
  plan: "founder_basic", planLabel: "Basic",
  allowance: { plan_type: "founder_basic", label: "Basic", contacts, emails_per_month: contacts * 2, sort: 1 },
  topUp: tier(0), contacts, emails: contacts * 2, emailsUsed: 0, periodStart: "x", periodEnd: "y",
});
const acc = (o: Partial<FounderDirectoryAccess> = {}): FounderDirectoryAccess => ({
  tier: tier(0), limits: lim(1000), status: "active", statusReason: null, termsAccepted: true, termsAcceptedAt: "x", held: 0, importedToday: 0, ...o,
});

describe("decideImport", () => {
  it("allows within limits", () => {
    expect(decideImport(10, acc(), DEFAULT_SETTINGS)).toEqual({ ok: true, allowed: 10, trimmedBy: "none" });
  });
  it("blocks suspended, paused, terms and free", () => {
    expect(decideImport(1, acc({ status: "suspended" }), DEFAULT_SETTINGS)).toMatchObject({ ok: false, reason: "suspended" });
    expect(decideImport(1, acc({ status: "paused" }), DEFAULT_SETTINGS)).toMatchObject({ ok: false, reason: "paused" });
    expect(decideImport(1, acc({ termsAccepted: false }), DEFAULT_SETTINGS)).toMatchObject({ ok: false, reason: "terms" });
    expect(decideImport(1, acc({ limits: lim(0) }), DEFAULT_SETTINGS)).toMatchObject({ ok: false, reason: "free_plan" });
  });
  it("skips the terms check when terms are not required", () => {
    expect(decideImport(1, acc({ termsAccepted: false }), { ...DEFAULT_SETTINGS, require_terms: false })).toMatchObject({ ok: true });
  });
  it("trims to the plan limit and the daily cap", () => {
    expect(decideImport(50, acc({ held: 990 }), DEFAULT_SETTINGS)).toEqual({ ok: true, allowed: 10, trimmedBy: "hold_limit" });
    expect(decideImport(50, acc({ importedToday: 480 }), DEFAULT_SETTINGS)).toEqual({ ok: true, allowed: 20, trimmedBy: "daily_cap" });
    expect(decideImport(5, acc({ held: 1000 }), DEFAULT_SETTINGS)).toMatchObject({ ok: false, reason: "hold_limit" });
    expect(decideImport(5, acc({ importedToday: 500 }), DEFAULT_SETTINGS)).toMatchObject({ ok: false, reason: "daily_cap" });
  });
  it("ignores the plan limit when blocking is off", () => {
    expect(decideImport(5, acc({ held: 1000 }), { ...DEFAULT_SETTINGS, block_over_limit: false })).toEqual({ ok: true, allowed: 5, trimmedBy: "none" });
  });
});

describe("usage", () => {
  it("needs enough sends before judging bounces", () => {
    expect(bounceRate(10, 5, 50)).toBeNull();
    expect(bounceRate(100, 12, 50)).toBe(12);
  });
  it("flags in priority order", () => {
    const base = { status: "active" as const, importsInWindow: 0, sent: 0, bounced: 0 };
    expect(usageFlag(base, DEFAULT_SETTINGS)).toBe("normal");
    expect(usageFlag({ ...base, importsInWindow: 4100 }, DEFAULT_SETTINGS)).toBe("spike");
    expect(usageFlag({ ...base, sent: 220, bounced: 40 }, DEFAULT_SETTINGS)).toBe("review");
    expect(usageFlag({ ...base, status: "paused", sent: 220, bounced: 40 }, DEFAULT_SETTINGS)).toBe("paused");
  });
  it("starts the PT day at local midnight", () => {
    // 2026-10-09 10:00 UTC is 03:00 PDT, so the PT day began at 07:00 UTC.
    expect(startOfTodayPT(new Date("2026-10-09T10:00:00.000Z"))).toBe("2026-10-09T07:00:00.000Z");
  });
});
