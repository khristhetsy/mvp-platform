import { describe, it, expect, afterAll } from "vitest";
import { closePool, hasColumn, hasUniqueOn, isRlsEnabled } from "./db";

// These assert — against a REAL database with migrations applied — the schema
// facts the money and compliance code depends on. Unlike unit tests, these can
// only be verified with a live Postgres, which is exactly why the earlier audit
// had to query the DB rather than grep the migrations. If someone adds a
// sensitive table without RLS, or drops a constraint the race-safety of SPV
// seeding relies on, this suite fails.

afterAll(async () => {
  await closePool();
});

// Tables that hold investor PII, money, or an audit trail. Every one MUST have
// row-level security so the anon key can't reach it if application code slips.
const RLS_REQUIRED_TABLES = [
  "subscriptions",
  "spv_participations",
  "spv_participation_requirements",
  "spv_checklist_items",
  "spv_opportunities",
  "marketplace_listings",
  "listing_interest",
  "investor_founder_matches",
  "diligence_reports",
  "sales_bulk_assign_audit",
  "marketing_settings",
  "crm_facet_cache",
] as const;

describe("RLS is enabled on sensitive tables", () => {
  for (const table of RLS_REQUIRED_TABLES) {
    it(`${table} has row-level security enabled`, async () => {
      expect(await isRlsEnabled(table)).toBe(true);
    });
  }
});

describe("unique constraints that make writes race-safe", () => {
  it("spv_participation_requirements is unique per (participation, requirement_key)", async () => {
    // This is what makes the idempotent seed safe under concurrent invites.
    expect(await hasUniqueOn("spv_participation_requirements", ["spv_participation_id", "requirement_key"])).toBe(true);
  });

  it("spv_checklist_items is unique per (opportunity, item_key)", async () => {
    expect(await hasUniqueOn("spv_checklist_items", ["spv_opportunity_id", "item_key"])).toBe(true);
  });

  it("one subscription row per profile", async () => {
    expect(await hasUniqueOn("subscriptions", ["profile_id"])).toBe(true);
  });
});

describe("columns the billing code writes", () => {
  it("subscriptions.grace_period_ends_at exists (bounded past_due access)", async () => {
    expect(await hasColumn("subscriptions", "grace_period_ends_at")).toBe(true);
  });

  it("subscriptions.plan_type and monthly_price_cents exist", async () => {
    expect(await hasColumn("subscriptions", "plan_type")).toBe(true);
    expect(await hasColumn("subscriptions", "monthly_price_cents")).toBe(true);
  });
});
