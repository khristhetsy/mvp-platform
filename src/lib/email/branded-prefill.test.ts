import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/ir/db", () => ({ db: vi.fn(), entrepreneurProfile: vi.fn(), getProject: vi.fn() }));
import { raiseFromRequest, splitNumbered } from "./branded-prefill";

describe("raiseFromRequest", () => {
  it("reads the raise out of Odoo's request note", () => {
    expect(raiseFromRequest("Raise-2.5-Mil-Revenue-150-200K")).toBe("$2.5M");
    expect(raiseFromRequest("raise $500k seed")).toBe("$500K");
    expect(raiseFromRequest("Raise 3 million")).toBe("$3M");
  });
  it("is null when no amount is written", () => {
    expect(raiseFromRequest("Intro call next week")).toBeNull();
    expect(raiseFromRequest("")).toBeNull();
  });
});

describe("splitNumbered", () => {
  it("puts each numbered highlight on its own line", () => {
    expect(splitNumbered("1. Founder fit Forty years. 2. Proof Seven customers. 3. Revenue RTM.")).toBe(
      "Founder fit Forty years.\nProof Seven customers.\nRevenue RTM.",
    );
  });
  it("keeps unnumbered text", () => {
    expect(splitNumbered("One block of text.")).toBe("One block of text.");
  });
  it("does not split on numbers inside a highlight", () => {
    expect(splitNumbered("1. Scale 33 sites, 1,111 patients. 2. Exits 19 collective exits.")).toBe(
      "Scale 33 sites, 1,111 patients.\nExits 19 collective exits.",
    );
  });
});

import { companyFields, parseFounderRef, valuesFrom } from "./branded-prefill";

describe("parseFounderRef", () => {
  it("reads the founder stored on a template", () => {
    expect(parseFounderRef("project:8ec4ac75-d72b-4a0a-a166-436f4faafd4c")).toEqual({ kind: "project", id: "8ec4ac75-d72b-4a0a-a166-436f4faafd4c" });
    expect(parseFounderRef("company:5eaa251f-1dd7-4043-9104-c994733ba70b")?.kind).toBe("company");
    expect(parseFounderRef("project:nope")).toBeNull();
    expect(parseFounderRef(undefined)).toBeNull();
  });
});

describe("company profile → template values", () => {
  const fields = companyFields({
    company_name: "Acme Health", business_description: "Acme builds care software.", key_highlights: "1. Fast growth 40% MoM. 2. Paid pilots with 3 systems.",
    funding_amount: 2000000, funding_stage: "Seed", operating_stage: "Growth", seeking_capital_types: '["Equity Capital"]', annual_revenue_size: "$100k - $250k",
    use_of_funds: "Hiring", industry: "Digital Health", website: "https://acme.test", logo_url: "https://cdn.test/acme.png", seeking_investor_types: null,
  });
  it("lists every filled field with a label, skipping empty ones", () => {
    expect(fields.map((f) => f.label)).toEqual(["Company", "Website", "Business description", "Key highlights", "Raise", "Funding stage", "Capital type", "Revenue / EBITDA", "Use of funds", "Industries", "Logo"]);
    expect(fields.find((f) => f.key === "capital_type")!.value).toBe("Equity Capital");
  });
  it("maps them onto the template", () => {
    const { values, sources } = valuesFrom(fields);
    expect(values).toMatchObject({
      company_name: "Acme Health", headline: "Introducing Acme Health", body: "Acme builds care software.",
      considerations: "Fast growth 40% MoM.\nPaid pilots with 3 systems.", logo_image: "https://cdn.test/acme.png",
    });
    expect(values.terms).toBe("Raise: $2,000,000\nFunding stage: Seed\nCapital type: Equity Capital\nRevenue: $100k - $250k\nUse of funds: Hiring");
    expect(sources.body).toBe("Business description");
  });
});
