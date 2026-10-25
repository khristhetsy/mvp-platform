import { describe, expect, it } from "vitest";
import { addressLines, parseBillingAddress, readStoredAddress } from "./address";

const good = { company: "Acme, Inc", line1: "100 Main Street", line2: "Suite 200", city: "San Diego", state: "California", postalCode: "92101", country: "United States", taxId: "" };

describe("billing address", () => {
  it("accepts a complete address and trims fields", () => {
    const r = parseBillingAddress({ ...good, company: "  Acme, Inc  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.company).toBe("Acme, Inc");
  });

  it("requires company, street, city, postal code, and country", () => {
    for (const k of ["company", "line1", "city", "postalCode", "country"] as const) {
      expect(parseBillingAddress({ ...good, [k]: " " }).ok).toBe(false);
    }
  });

  it("allows an empty line 2, state, and tax id", () => {
    expect(parseBillingAddress({ ...good, line2: "", state: "", taxId: "" }).ok).toBe(true);
  });

  it("rejects non objects and overlong fields", () => {
    expect(parseBillingAddress(null).ok).toBe(false);
    expect(parseBillingAddress({ ...good, line1: "x".repeat(201) }).ok).toBe(false);
  });

  it("builds invoice lines", () => {
    expect(addressLines(good)).toEqual(["100 Main Street", "Suite 200", "San Diego, California 92101", "United States"]);
    expect(addressLines({ ...good, taxId: "FR123" }).at(-1)).toBe("Tax ID: FR123");
    expect(addressLines(null)).toEqual([]);
  });

  it("ignores a malformed stored value", () => {
    expect(readStoredAddress({ company: "x" })).toBeNull();
    expect(readStoredAddress(good)).not.toBeNull();
  });
});
