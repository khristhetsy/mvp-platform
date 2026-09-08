import { describe, it, expect } from "vitest";
import { conditionTerms, applyFilterSpec, isValidCondition, type FilterSpec } from "./contact-filter-spec";

describe("conditionTerms", () => {
  it("text contains → ilike term", () => {
    expect(conditionTerms({ field: "name", op: "contains", value: "acme" })).toEqual(["name.ilike.%acme%"]);
  });
  it("text equals → case-insensitive ilike (or()-safe)", () => {
    expect(conditionTerms({ field: "company", op: "equals", value: "Acme Inc" })).toEqual([`company.ilike.Acme Inc`]);
  });
  it("set / not_set on a column", () => {
    expect(conditionTerms({ field: "email", op: "set" })).toEqual(["email.not.is.null"]);
    expect(conditionTerms({ field: "email", op: "not_set" })).toEqual(["email.is.null"]);
  });
  it("country is any of → one ilike term per value", () => {
    expect(conditionTerms({ field: "country", op: "in", value: ["United States", "Canada"] })).toEqual([
      `country.ilike.United States`,
      `country.ilike.Canada`,
    ]);
  });
  it("type maps to contact_type OR module", () => {
    expect(conditionTerms({ field: "type", op: "in", value: ["investor", "founder"] })).toEqual([
      "contact_type.eq.investor",
      "module.eq.investor",
      "contact_type.eq.founder",
      "module.eq.founder",
    ]);
  });
  it("lead source spans overrides + profile (ilike, multi-word safe)", () => {
    expect(conditionTerms({ field: "leadSource", op: "in", value: "SEC Form D" })).toEqual([
      `overrides->>lead_source.ilike.SEC Form D`,
      `raw->__profile->>leadSource.ilike.SEC Form D`,
    ]);
  });
  it("facet contains → jsonb containment, quoted for or()", () => {
    expect(conditionTerms({ field: "fundingStages", op: "in", value: "Seed" })).toEqual([
      `raw->__profile->fundingStages.cs."[""Seed""]"`,
    ]);
  });
  it("date after/before", () => {
    expect(conditionTerms({ field: "createdAt", op: "after", value: "2026-01-01" })).toEqual(["created_at.gte.2026-01-01"]);
    expect(conditionTerms({ field: "createdAt", op: "before", value: "2026-06-01" })).toEqual(["created_at.lte.2026-06-01"]);
  });
  it("assignee set / not_set", () => {
    expect(conditionTerms({ field: "assignee", op: "not_set" })).toEqual(["assignee_ids.is.null"]);
  });
  it("rejects invalid field/op/value", () => {
    expect(conditionTerms({ field: "nope", op: "contains", value: "x" })).toBeNull();
    expect(conditionTerms({ field: "name", op: "after", value: "x" })).toBeNull();
    expect(conditionTerms({ field: "name", op: "contains", value: "a,b" })).toBeNull(); // comma unsafe for ilike
    expect(isValidCondition({ field: "email", op: "set" })).toBe(true);
  });
});

describe("applyFilterSpec", () => {
  function fakeQuery() {
    const calls: string[] = [];
    const q = { or: (s: string) => { calls.push(s); return q; }, calls };
    return q;
  }
  it("all: one .or() per condition (AND between them)", () => {
    const spec: FilterSpec = { match: "all", conditions: [
      { field: "type", op: "in", value: ["investor"] },
      { field: "email", op: "set" },
    ] };
    const q = fakeQuery();
    applyFilterSpec(q, spec);
    expect(q.calls).toEqual(["contact_type.eq.investor,module.eq.investor", "email.not.is.null"]);
  });
  it("any: single .or() across every term", () => {
    const spec: FilterSpec = { match: "any", conditions: [
      { field: "name", op: "contains", value: "acme" },
      { field: "company", op: "contains", value: "acme" },
    ] };
    const q = fakeQuery();
    applyFilterSpec(q, spec);
    expect(q.calls).toEqual(["name.ilike.%acme%,company.ilike.%acme%"]);
  });
  it("skips invalid conditions", () => {
    const spec: FilterSpec = { match: "all", conditions: [{ field: "bad", op: "contains", value: "x" }] };
    const q = fakeQuery();
    applyFilterSpec(q, spec);
    expect(q.calls).toEqual([]);
  });
});
