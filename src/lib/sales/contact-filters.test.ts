import { describe, it, expect } from "vitest";
import { applyContactFilters } from "./contact-filters";

// Pins the exact PostgREST operands applyContactFilters builds. The facet + lead
// source paths carry the same multi-word / quoting hazard that broke Group by, so
// these lock in the fix (single value → .filter() containment; multiple → quoted
// or(); lead source values double-quoted) against future edits.

// Minimal query-builder stand-in that records method calls and chains.
function mockQuery() {
  const calls: Array<{ m: string; args: unknown[] }> = [];
  const q: Record<string, (...a: unknown[]) => unknown> = {};
  for (const m of ["or", "ilike", "in", "filter"]) {
    q[m] = (...args: unknown[]) => { calls.push({ m, args }); return q; };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { q: q as any, calls };
}

const params = (init: Record<string, string | string[]>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(init)) {
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  return sp;
};

describe("applyContactFilters", () => {
  it("global search hits name/email/company/phone via a single or()", () => {
    const { q, calls } = mockQuery();
    applyContactFilters(q, params({ q: "acme" }));
    expect(calls).toContainEqual({ m: "or", args: ["name.ilike.%acme%,email.ilike.%acme%,company.ilike.%acme%,phone.ilike.%acme%"] });
  });

  it("per-column text filter uses ilike", () => {
    const { q, calls } = mockQuery();
    applyContactFilters(q, params({ company: "north" }));
    expect(calls).toContainEqual({ m: "ilike", args: ["company", "%north%"] });
  });

  it("country csv uses .in()", () => {
    const { q, calls } = mockQuery();
    applyContactFilters(q, params({ country: "US,UK" }));
    expect(calls).toContainEqual({ m: "in", args: ["country", ["US", "UK"]] });
  });

  it("single facet value uses .filter() containment (survives multi-word)", () => {
    const { q, calls } = mockQuery();
    applyContactFilters(q, params({ investorTypes: "Venture Capital" }));
    expect(calls).toContainEqual({ m: "filter", args: ["raw->__profile->investorTypes", "cs", '["Venture Capital"]'] });
  });

  it("multiple facet values OR with quote-escaped jsonb operands", () => {
    const { q, calls } = mockQuery();
    applyContactFilters(q, params({ industries: ["FinTech", "Health Care"] }));
    const orCall = calls.find((c) => c.m === "or" && String(c.args[0]).includes("raw->__profile->industries.cs"));
    expect(orCall?.args[0]).toBe('raw->__profile->industries.cs."[""FinTech""]",raw->__profile->industries.cs."[""Health Care""]"');
  });

  it("lead source values are double-quoted across both columns", () => {
    const { q, calls } = mockQuery();
    applyContactFilters(q, params({ leadSource: "SEC Form D" }));
    const orCall = calls.find((c) => c.m === "or" && String(c.args[0]).includes("lead_source"));
    expect(orCall?.args[0]).toBe('overrides->>lead_source.eq."SEC Form D",raw->__profile->>leadSource.eq."SEC Form D"');
  });

  it("does nothing extra when no filters are present", () => {
    const { q, calls } = mockQuery();
    applyContactFilters(q, params({}));
    expect(calls).toEqual([]);
  });
});
