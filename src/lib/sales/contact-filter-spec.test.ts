import { describe, it, expect } from "vitest";
import { conditionTerms, applyFilterSpec, splitTerm, isValidCondition, type FilterSpec } from "./contact-filter-spec";

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
  it("lead source spans overrides + profile (plain quoted eq — indexed, no JSON)", () => {
    expect(conditionTerms({ field: "leadSource", op: "in", value: "SEC Form D" })).toEqual([
      `overrides->>lead_source.eq."SEC Form D"`,
      `profile->>leadSource.eq."SEC Form D"`,
    ]);
  });
  it("facet contains → jsonb containment, backslash-quoted for or()", () => {
    // PostgREST's quoted-value grammar escapes with backslash; `""` is not valid and
    // made every JSON operand 400 (the list showed "No matching contacts").
    expect(conditionTerms({ field: "fundingStages", op: "in", value: "Seed" })).toEqual([
      `profile.cs."{\\"fundingStages\\":[\\"Seed\\"]}"`,
    ]);
  });
  it("splitTerm un-quotes an or() operand back to the raw value", () => {
    expect(splitTerm(`profile.cs."{\\"fundingStages\\":[\\"Seed\\"]}"`)).toEqual({ col: "profile", op: "cs", value: '{"fundingStages":["Seed"]}' });
    expect(splitTerm("email.not.is.null")).toEqual({ col: "email", op: "not.is", value: "null" });
    expect(splitTerm(`overrides->>lead_source.eq."SEC Form D"`)).toEqual({ col: "overrides->>lead_source", op: "eq", value: "SEC Form D" });
  });
  it("date after/before", () => {
    expect(conditionTerms({ field: "createdAt", op: "after", value: "2026-01-01" })).toEqual(["created_on.gte.2026-01-01"]);
    expect(conditionTerms({ field: "createdAt", op: "before", value: "2026-06-01" })).toEqual(["created_on.lte.2026-06-01"]);
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
    const q = {
      or: (s: string) => { calls.push(s); return q; },
      filter: (col: string, op: string, value: string) => { calls.push(`filter:${col}|${op}|${value}`); return q; },
      calls,
    };
    return q;
  }
  it("all: multi-term conditions use .or(); single terms go through .filter() verbatim", () => {
    const spec: FilterSpec = { match: "all", conditions: [
      { field: "type", op: "in", value: ["investor"] },
      { field: "email", op: "set" },
      { field: "investorTypes", op: "in", value: ["Angel Investor"] },
    ] };
    const q = fakeQuery();
    applyFilterSpec(q, spec);
    expect(q.calls).toEqual([
      "contact_type.eq.investor,module.eq.investor",
      "filter:email|not.is|null",
      'filter:profile|cs|{"investorTypes":["Angel Investor"]}',
    ]);
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
