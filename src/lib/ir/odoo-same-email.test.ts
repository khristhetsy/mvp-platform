import { describe, expect, it } from "vitest";
import { pickSameEmail } from "./odoo-import";

const row = (id: string, o: Partial<{ source: string; contact_type: string; profile: Record<string, unknown> | null; created_on: string | null }> = {}) =>
  ({ id, source: "odoo", contact_type: "other", profile: null, created_on: null, ...o });

describe("pickSameEmail", () => {
  it("prefers the record with a filled investor profile over blank duplicates", () => {
    const blankOdoo = row("blank", { created_on: "2024-10-02" });
    const irDupe = row("ir", { source: "odoo-ir", contact_type: "investor", profile: { investorTypes: [] } });
    const full = row("full", { contact_type: "investor", created_on: "2023-03-02", profile: { industries: ["Healthcare"], investorTypes: ["Venture Capital"] } });
    expect(pickSameEmail([blankOdoo, irDupe, full])?.id).toBe("full");
  });
  it("with no profiles, prefers an investor record not created by the Investor Relations import", () => {
    expect(pickSameEmail([row("ir", { source: "odoo-ir", contact_type: "investor" }), row("inv", { contact_type: "investor" }), row("other")])?.id).toBe("inv");
  });
  it("returns null for no rows", () => { expect(pickSameEmail([])).toBeNull(); });
});
