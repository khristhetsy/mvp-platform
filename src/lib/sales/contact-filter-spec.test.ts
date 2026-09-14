import { describe, it, expect } from "vitest";
import { isValidCondition, fieldDef, FIELD_REGISTRY, GROUPABLE_FIELDS } from "./contact-filter-spec";

// The spec → SQL translation lives in Postgres now (contacts_spec_where, see
// search-contacts.pg.test.ts). This file only pins the client-side shape checks.

describe("isValidCondition", () => {
  it("accepts a known field with a supported op and a value", () => {
    expect(isValidCondition({ field: "name", op: "contains", value: "acme" })).toBe(true);
    expect(isValidCondition({ field: "country", op: "in", value: ["United States", "Canada"] })).toBe(true);
    expect(isValidCondition({ field: "createdAt", op: "after", value: "2026-01-01" })).toBe(true);
  });
  it("set / not_set need no value", () => {
    expect(isValidCondition({ field: "email", op: "set" })).toBe(true);
    expect(isValidCondition({ field: "assignee", op: "not_set" })).toBe(true);
  });
  it("rejects unknown field, unsupported op, or an empty value", () => {
    expect(isValidCondition({ field: "nope", op: "contains", value: "x" })).toBe(false);
    expect(isValidCondition({ field: "name", op: "after", value: "x" })).toBe(false);
    expect(isValidCondition({ field: "name", op: "contains", value: "   " })).toBe(false);
    expect(isValidCondition({ field: "industries", op: "in", value: [] })).toBe(false);
  });
});

describe("field registry", () => {
  it("every groupable field is a registered field", () => {
    for (const key of GROUPABLE_FIELDS) expect(fieldDef(key)?.key).toBe(key);
  });
  it("keys are unique", () => {
    const keys = FIELD_REGISTRY.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
