import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/crr/crr-for", () => ({ crrScoresFor: async () => new Map() }));
vi.mock("@/lib/listing/deal-notices", () => ({
  raisingLabel: (amount: number | null, band: string | null) =>
    typeof amount === "number" && amount > 0 ? `Raising $${amount}` : band ? `Raising ${band}` : null,
}));

import {
  applyPrivateMarketFilter,
  dealOptInRedirect,
  founderPlanHidesInvestors,
  introRuleForFounderPlan,
  listingFacets,
  sectorsOf,
  toListedCompany,
  truncateDescription,
  type ListedCompany,
} from "./private-market";

function row(p: Partial<ListedCompany> & { id: string }): ListedCompany {
  return {
    name: p.id.toUpperCase(),
    industry: null,
    stage: null,
    location: null,
    raising: null,
    description: null,
    crr: null,
    listedAt: "2026-10-01T00:00:00Z",
    ...p,
  };
}

const rows: ListedCompany[] = [
  row({ id: "a", crr: 82, industry: "Fintech, AI", stage: "Seed", listedAt: "2026-10-01T00:00:00Z" }),
  row({ id: "b", crr: 45, industry: "Health", stage: "Series A", listedAt: "2026-10-05T00:00:00Z" }),
  row({ id: "c", crr: null, industry: "AI", stage: "Seed", listedAt: "2026-10-08T00:00:00Z" }),
  row({ id: "d", crr: 61, industry: "fintech", stage: "seed", listedAt: "2026-10-03T00:00:00Z" }),
];

describe("applyPrivateMarketFilter", () => {
  it("lists every company with Any CRR, unscored last, highest CRR first", () => {
    expect(applyPrivateMarketFilter(rows).map((r) => r.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("drops unscored and lower scores under a CRR floor", () => {
    expect(applyPrivateMarketFilter(rows, { minCrr: 60 }).map((r) => r.id)).toEqual(["a", "d"]);
    expect(applyPrivateMarketFilter(rows, { minCrr: 80 }).map((r) => r.id)).toEqual(["a"]);
  });

  it("matches any sector in a multi sector industry, case insensitive", () => {
    expect(applyPrivateMarketFilter(rows, { sector: "AI" }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(applyPrivateMarketFilter(rows, { sector: "Fintech" }).map((r) => r.id)).toEqual(["a", "d"]);
  });

  it("filters by stage and sorts newest first", () => {
    expect(applyPrivateMarketFilter(rows, { stage: "Seed", sort: "newest" }).map((r) => r.id)).toEqual(["c", "d", "a"]);
  });

  it("does not mutate the input", () => {
    const copy = rows.map((r) => r.id);
    applyPrivateMarketFilter(rows, { sort: "newest" });
    expect(rows.map((r) => r.id)).toEqual(copy);
  });
});

describe("listingFacets and sectorsOf", () => {
  it("splits sectors and collects stages from the listed set", () => {
    expect(sectorsOf(" Fintech ,AI,, ")).toEqual(["Fintech", "AI"]);
    const f = listingFacets(rows);
    expect(f.sectors).toEqual(["AI", "Fintech", "Health"]);
    expect(f.stages).toEqual(["Seed", "Series A"]);
  });
});

describe("truncateDescription", () => {
  it("returns null for empty text and keeps short text", () => {
    expect(truncateDescription("  ")).toBeNull();
    expect(truncateDescription("Short  text")).toBe("Short text");
  });
  it("cuts at a word boundary with an ellipsis", () => {
    const out = truncateDescription("word ".repeat(100), 40)!;
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("  ");
  });
});

describe("toListedCompany", () => {
  it("builds the listing summary", () => {
    const c = toListedCompany(
      {
        id: "x", company_name: " Acme ", industry: "AI", funding_stage: "Seed", state: "CA", country: "US",
        funding_amount: 500000, funding_amount_band: null, business_description: "Builds things.",
        listing_completed_at: "2026-10-09T00:00:00Z",
      },
      72,
    );
    expect(c).toMatchObject({ name: "Acme", location: "CA, US", raising: "Raising $500000", crr: 72, description: "Builds things." });
  });
});

describe("introRuleForFounderPlan", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  it("masks and expires after 14 days for free and trial founders", () => {
    for (const plan of ["founder_free", "founder_trial"]) {
      const r = introRuleForFounderPlan(plan, now);
      expect(r.masked).toBe(true);
      expect(r.expiresAt).toBe("2026-10-23T12:00:00.000Z");
    }
  });
  it("leaves paid and unknown plans unchanged", () => {
    for (const plan of ["founder_basic", "founder_professional", "founder_premium", null, undefined]) {
      expect(introRuleForFounderPlan(plan, now)).toEqual({ masked: false, expiresAt: null });
    }
    expect(founderPlanHidesInvestors("founder_basic")).toBe(false);
  });
});

describe("dealOptInRedirect", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  it("sends a signed in investor to the company card", () => {
    expect(dealOptInRedirect({ companyId: id, email: "a@b.co", signedInRole: "investor" })).toBe(`/investor/opportunities?company=${id}`);
  });
  it("sends everyone else to investor sign up with the email prefilled", () => {
    expect(dealOptInRedirect({ companyId: id, email: "a+x@b.co", signedInRole: null })).toBe("/auth/sign-up?role=investor&email=a%2Bx%40b.co");
    expect(dealOptInRedirect({ companyId: id, email: null, signedInRole: "founder" })).toBe("/auth/sign-up?role=investor");
  });
  it("signs in with the company card as next", () => {
    expect(dealOptInRedirect({ companyId: id, email: null, signedInRole: null, mode: "signin" })).toBe(
      `/auth/sign-in?next=${encodeURIComponent(`/investor/opportunities?company=${id}`)}`,
    );
  });
});
