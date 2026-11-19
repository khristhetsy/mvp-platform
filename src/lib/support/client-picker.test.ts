import { describe, expect, it } from "vitest";
import { cleanSearch, planLabelFor, shapeClients } from "./client-picker";

describe("cleanSearch", () => {
  it("removes characters that break the filter or act as wildcards", () => {
    expect(cleanSearch("a%b_c,d(e)f*g")).toBe("a b c d e f g");
  });

  it("trims, collapses spaces and caps the length", () => {
    expect(cleanSearch("  Northwind   Labs  ")).toBe("Northwind Labs");
    expect(cleanSearch("x".repeat(200))).toHaveLength(80);
  });

  it("returns an empty string for nothing usable", () => {
    expect(cleanSearch("%_,")).toBe("");
  });
});

describe("planLabelFor", () => {
  it("labels known plans and blanks unknown or missing ones", () => {
    expect(planLabelFor("founder_basic")).not.toBe("");
    expect(planLabelFor("not_a_plan")).toBe("");
    expect(planLabelFor(null)).toBe("");
  });
});

describe("shapeClients", () => {
  const companies = new Map([["f1", "Northwind Labs"]]);
  const plans = new Map([["f1", "founder_basic"], ["i1", "investor_free"]]);

  it("gives a founder their company and plan", () => {
    const [c] = shapeClients([{ id: "f1", full_name: "Maria Alvarez", email: "m@n.io", role: "founder" }], companies, plans);
    expect(c).toMatchObject({ name: "Maria Alvarez", role: "founder", company: "Northwind Labs" });
    expect(c.plan).not.toBe("");
  });

  it("leaves company and plan empty for an investor", () => {
    const [c] = shapeClients([{ id: "i1", full_name: "Elena Rossi", email: "e@r.com", role: "investor" }], companies, plans);
    expect(c).toMatchObject({ role: "investor", company: "", plan: "" });
  });

  it("falls back to the email when there is no name, and drops other roles", () => {
    const out = shapeClients(
      [
        { id: "f2", full_name: "  ", email: "x@y.com", role: "founder" },
        { id: "a1", full_name: "Staff", email: "s@i.com", role: "admin" },
      ],
      companies,
      plans,
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("x@y.com");
  });
});
