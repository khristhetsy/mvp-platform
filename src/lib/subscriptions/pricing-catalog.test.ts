import { describe, expect, it } from "vitest";
import {
  CODE_DEFAULT_PRICING, addCompanyLabel, centsFor, diffPricing, money, nextPricingVersion,
  priceLabel, priceShort, priceSublabel, priceSurfaces, pricingFromRow, signupFounderPlans,
  summarizePricingDiff, validatePricing, type PricingCatalog, type PricingSetRow,
} from "@/lib/subscriptions/pricing-catalog";

const clone = (c: PricingCatalog): PricingCatalog => JSON.parse(JSON.stringify(c));
const withPro = (cents: number) => {
  const c = clone(CODE_DEFAULT_PRICING);
  c.plans.founder_professional.cents = cents;
  return c;
};

describe("money", () => {
  it("drops the cents when they're zero and keeps them when they aren't", () => {
    expect(money(0)).toBe("$0");
    expect(money(4900)).toBe("$49");
    expect(money(350000)).toBe("$3,500");
    expect(money(4950)).toBe("$49.50");
  });
});

describe("labels", () => {
  it("derives the label from the amount unless the plan carries words", () => {
    expect(priceLabel(CODE_DEFAULT_PRICING, "founder_basic")).toBe("$49");
    expect(priceLabel(CODE_DEFAULT_PRICING, "founder_professional")).toBe("$199");
    expect(priceLabel(CODE_DEFAULT_PRICING, "founder_managed_ir")).toBe("Pricing on request");
  });

  it("follows the amount when it moves — no stale label left behind", () => {
    expect(priceLabel(withPro(24900), "founder_professional")).toBe("$249");
    expect(priceShort(withPro(24900), "founder_professional")).toBe("$249/mo");
  });

  it("uses the words, not an amount, in the compact form for sales-led tiers", () => {
    expect(priceShort(CODE_DEFAULT_PRICING, "founder_managed_ir")).toBe("Pricing on request");
  });

  it("falls back to /month and the code price for plans it doesn't hold", () => {
    expect(priceSublabel(CODE_DEFAULT_PRICING, "investor_free")).toBe("/month");
    expect(centsFor(CODE_DEFAULT_PRICING, "investor_free")).toBe(0);
  });

  it("prints the add-company price per month", () => {
    expect(addCompanyLabel(CODE_DEFAULT_PRICING)).toBe("$800/mo");
  });
});

describe("validatePricing", () => {
  const draft = (c: PricingCatalog) => ({ plans: c.plans, addCompanyCents: c.addCompanyCents });

  it("accepts the code defaults", () => {
    expect(validatePricing(draft(CODE_DEFAULT_PRICING))).toEqual([]);
  });

  it("insists the free plan is free", () => {
    const c = clone(CODE_DEFAULT_PRICING);
    c.plans.founder_free.cents = 100;
    expect(validatePricing(draft(c)).some((e) => e.includes("free plan must cost $0"))).toBe(true);
  });

  it("rejects fractional cents and absurd amounts", () => {
    const frac = clone(CODE_DEFAULT_PRICING);
    frac.plans.founder_basic.cents = 4900.5;
    expect(validatePricing(draft(frac)).length).toBe(1);

    const huge = clone(CODE_DEFAULT_PRICING);
    huge.plans.founder_basic.cents = 100_000_01;
    expect(validatePricing(draft(huge)).length).toBe(1);
  });

  it("rejects an over-long label", () => {
    const c = clone(CODE_DEFAULT_PRICING);
    c.plans.founder_basic.label = "x".repeat(41);
    expect(validatePricing(draft(c)).some((e) => e.includes("label is too long"))).toBe(true);
  });
});

describe("diffPricing", () => {
  it("is empty for identical catalogues", () => {
    expect(diffPricing(CODE_DEFAULT_PRICING, clone(CODE_DEFAULT_PRICING))).toEqual([]);
  });

  it("names the plan, the before and the after", () => {
    const rows = diffPricing(CODE_DEFAULT_PRICING, withPro(24900));
    expect(rows).toEqual([{ plan: "founder_professional", field: "price", before: "$199", after: "$249" }]);
    expect(summarizePricingDiff(rows)).toBe("Professional $199 → $249");
  });

  it("notices the add-company price and label-only edits", () => {
    const c = clone(CODE_DEFAULT_PRICING);
    c.addCompanyCents = 90000;
    c.plans.founder_basic.sublabel = "/mo";
    const rows = diffPricing(CODE_DEFAULT_PRICING, c);
    expect(rows.map((r) => r.plan)).toContain("additional_company");
    expect(rows.some((r) => r.field === "sub-label")).toBe(true);
  });

  it("says so plainly when nothing moved", () => {
    expect(summarizePricingDiff([])).toBe("No change");
  });
});

describe("nextPricingVersion", () => {
  it("increments and skips names already taken", () => {
    expect(nextPricingVersion("pricing-v1", ["pricing-v1"])).toBe("pricing-v2");
    expect(nextPricingVersion("pricing-v1", ["pricing-v1", "pricing-v2"])).toBe("pricing-v3");
    expect(nextPricingVersion("prices", ["prices"])).toBe("prices-v2");
  });
});

describe("pricingFromRow", () => {
  const row: PricingSetRow = {
    id: "abc", version: "pricing-v2",
    plans: { founder_professional: { cents: 24900, sublabel: "/month" } },
    add_company_cents: 90000, reason: "Reprice", existing_policy: "migrate",
    effective_at: "2026-09-19T00:00:00Z", is_active: true, created_by: null, created_at: "2026-09-19T00:00:00Z",
  };

  it("layers the stored plans over the code defaults, so a partial row can't blank a plan", () => {
    const c = pricingFromRow(row);
    expect(c.plans.founder_professional.cents).toBe(24900);
    expect(c.plans.founder_basic.cents).toBe(CODE_DEFAULT_PRICING.plans.founder_basic.cents);
    expect(c.addCompanyCents).toBe(90000);
    expect(c.existingPolicy).toBe("migrate");
  });

  it("treats an unknown policy as grandfathering — the safe reading", () => {
    expect(pricingFromRow({ ...row, existing_policy: "nonsense" }).existingPolicy).toBe("grandfather");
  });
});

describe("signupFounderPlans", () => {
  it("lays the active prices over the signup card copy", () => {
    const cards = signupFounderPlans(withPro(24900));
    const pro = cards.find((c) => c.planType === "founder_professional");
    expect(pro?.priceLabel).toBe("$249");
    expect(pro?.priceSubtext).toBe("/month");
  });
});

describe("priceSurfaces", () => {
  it("renders every 'follows' row from the catalogue it is given", () => {
    const rows = priceSurfaces(withPro(24900)).filter((r) => r.status === "follows");
    expect(rows.length).toBeGreaterThan(5);
    const quoted = rows.map((r) => r.renders).join(" ");
    expect(quoted).toContain("$249");
    expect(quoted).not.toContain("$199");
  });

  it("keeps the hand-written and provider-side rows flagged rather than pretending they follow", () => {
    const rows = priceSurfaces(CODE_DEFAULT_PRICING);
    expect(rows.some((r) => r.status === "flagged")).toBe(true);
    expect(rows.some((r) => r.status === "provider")).toBe(true);
  });
});
