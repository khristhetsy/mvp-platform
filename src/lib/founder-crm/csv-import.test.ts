import { describe, it, expect } from "vitest";
import { parseCsvImportRows, dedupeImportRows } from "./csv-import";
import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";

function checkSize(value: string) {
  const [row] = parseCsvImportRows([{ investor_name: "A", check_size: value }]);
  return { min: row.data?.check_size_min ?? null, max: row.data?.check_size_max ?? null };
}

describe("parseCsvImportRows — check size", () => {
  it("handles a single value with a unit", () => {
    expect(checkSize("$1M")).toEqual({ min: 1_000_000, max: 1_000_000 });
    expect(checkSize("750k")).toEqual({ min: 750_000, max: 750_000 });
  });

  it("handles a same-unit range", () => {
    expect(checkSize("$1M - $5M")).toEqual({ min: 1_000_000, max: 5_000_000 });
  });

  it("regression: handles a MIXED-unit range correctly", () => {
    // Previously "500k" inherited the "m" multiplier and became 500,000,000.
    expect(checkSize("$500K – $2M")).toEqual({ min: 500_000, max: 2_000_000 });
    expect(checkSize("250k-1m")).toEqual({ min: 250_000, max: 1_000_000 });
  });

  it("treats unit-less numbers literally", () => {
    expect(checkSize("500")).toEqual({ min: 500, max: 500 });
  });

  it("returns null for empty or non-numeric input", () => {
    expect(checkSize("")).toEqual({ min: null, max: null });
    expect(checkSize("n/a")).toEqual({ min: null, max: null });
  });
});

describe("parseCsvImportRows — validation", () => {
  it("requires an investor name", () => {
    const [row] = parseCsvImportRows([{ firm_name: "Acme" }]);
    expect(row.valid).toBe(false);
    expect(row.errors).toContain("investor_name is required");
    expect(row.data).toBeNull();
  });

  it("flags an invalid email but keeps a valid row otherwise", () => {
    const [bad] = parseCsvImportRows([{ investor_name: "A", email: "notanemail" }]);
    expect(bad.errors).toContain("email is invalid");
    expect(bad.valid).toBe(false);

    const [good] = parseCsvImportRows([{ investor_name: "A", email: "a@b.com" }]);
    expect(good.valid).toBe(true);
    expect(good.data?.email).toBe("a@b.com");
  });

  it("trims fields and lowercases the email", () => {
    const [row] = parseCsvImportRows([{ investor_name: "  Jane  ", email: "  JANE@X.CO  ", firm_name: " Firm " }]);
    expect(row.data?.investor_name).toBe("Jane");
    expect(row.data?.email).toBe("jane@x.co");
    expect(row.data?.firm_name).toBe("Firm");
  });
});

describe("dedupeImportRows", () => {
  function existing(email: string): FounderInvestorContactRecord {
    return { email } as FounderInvestorContactRecord;
  }

  it("skips rows whose email already exists", () => {
    const parsed = parseCsvImportRows([{ investor_name: "A", email: "dup@x.co" }]);
    const result = dedupeImportRows(parsed, [existing("DUP@X.CO")]);
    expect(result[0].duplicate).toBe(true);
    expect(result[0].skipped).toBe(true);
  });

  it("skips a duplicate appearing twice within the same batch", () => {
    const parsed = parseCsvImportRows([
      { investor_name: "A", email: "x@x.co" },
      { investor_name: "B", email: "x@x.co" },
    ]);
    const result = dedupeImportRows(parsed, []);
    expect(result[0].skipped).toBe(false);
    expect(result[1].skipped).toBe(true);
  });

  it("does not dedupe rows without an email", () => {
    const parsed = parseCsvImportRows([
      { investor_name: "A" },
      { investor_name: "B" },
    ]);
    const result = dedupeImportRows(parsed, []);
    expect(result.every((r) => !r.skipped)).toBe(true);
  });
});
