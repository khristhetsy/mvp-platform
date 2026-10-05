import { describe, expect, it } from "vitest";
import { extractContacts, normalizePhone } from "./site";

const FOOTER = `<footer>Contact info@acmefund.com · Call +1 (858) 555-0100 · © 2019-2026 · Order ID 20260512 1234</footer><p>Jane Doe, Partner</p>`;

describe("normalizePhone (D5)", () => {
  it("rejects a date-shaped number", () => {
    expect(normalizePhone("20260512 1234")).toBeNull();
  });
  it("rejects a year range and a bare ID", () => {
    expect(normalizePhone("2019-2026")).toBeNull();
    expect(normalizePhone("4815162342")).toBeNull();
  });
  it("returns international numbers in E.164", () => {
    expect(normalizePhone("+1 (858) 555-0100")).toBe("+18585550100");
    expect(normalizePhone("0033 1 23 45 67 89")).toBe("+33123456789");
  });
  it("rejects written dates", () => {
    expect(normalizePhone("05.12.2026 1234")).toBeNull();
    expect(normalizePhone("2026-05-12 1234")).toBeNull();
  });
  it("accepts common US, French and UK formats", () => {
    expect(normalizePhone("(858) 555-0100")).toBe("(858) 555-0100");
    expect(normalizePhone("858.555.0100")).toBe("858.555.0100");
    expect(normalizePhone("858-555-0100")).toBe("858-555-0100");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("rejects unbalanced parentheses", () => {
    expect(normalizePhone("858) 555-0100")).toBeNull();
  });
  it("accepts a bare digit run only from a tel: link", () => {
    expect(normalizePhone("8585550100")).toBeNull();
    expect(normalizePhone("8585550100", { fromTelLink: true })).toBe("8585550100");
  });
  it("keeps a formatted national number", () => {
    expect(normalizePhone("01 23 45 67 89")).toBe("01 23 45 67 89");
  });
});

describe("extractContacts", () => {
  it("finds the real phone and drops the order number", () => {
    const c = extractContacts(FOOTER);
    expect(c.phones).toEqual(["+18585550100"]);
    expect(c.emails).toEqual(["info@acmefund.com"]);
  });
  it("captures a parenthesised area code whole", () => {
    expect(extractContacts("<p>Call (858) 555-0100 today</p>").phones).toEqual(["(858) 555-0100"]);
  });
  it("reads bare tel: links", () => {
    expect(extractContacts(`<a href="tel:8585550100">Call</a>`).phones).toEqual(["8585550100"]);
  });
  it("prefers tel: links", () => {
    const c = extractContacts(`<a href="tel:+33123456789">Appelez-nous</a>`);
    expect(c.phones[0]).toBe("+33123456789");
  });
});
