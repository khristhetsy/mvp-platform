import { describe, it, expect } from "vitest";
import { resolveContactFields, DEFAULT_CONTACT_FIELDS } from "./types";

describe("resolveContactFields", () => {
  it("returns the defaults when nothing is stored (existing links unchanged)", () => {
    expect(resolveContactFields(null)).toEqual(DEFAULT_CONTACT_FIELDS);
    expect(resolveContactFields(undefined)).toEqual(DEFAULT_CONTACT_FIELDS);
    expect(resolveContactFields({})).toEqual(DEFAULT_CONTACT_FIELDS);
  });

  it("merges a partial config over the defaults, field by field", () => {
    const out = resolveContactFields({
      company: { label: "Fund / firm", collect: true, required: true },
      phone: { label: "Phone", collect: false, required: false },
    });
    // Overridden fields take the stored values.
    expect(out.company).toEqual({ label: "Fund / firm", collect: true, required: true });
    expect(out.phone.collect).toBe(false);
    // Untouched fields fall back to defaults.
    expect(out.name).toEqual(DEFAULT_CONTACT_FIELDS.name);
    expect(out.email).toEqual(DEFAULT_CONTACT_FIELDS.email);
  });

  it("fills missing sub-keys within a field from the default", () => {
    // Only a renamed label stored; collect/required come from the default.
    const out = resolveContactFields({ company: { label: "Organization" } as never });
    expect(out.company.label).toBe("Organization");
    expect(out.company.collect).toBe(DEFAULT_CONTACT_FIELDS.company.collect);
    expect(out.company.required).toBe(DEFAULT_CONTACT_FIELDS.company.required);
  });
});
