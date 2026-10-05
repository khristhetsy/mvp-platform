import { describe, expect, it } from "vitest";
import { emailCandidates, inferEmails, nameTokens, normalizeNamePart, domainFromEmail } from "./pattern";

describe("emailCandidates (D2)", () => {
  it("ranks first.last first by default", () => {
    const c = emailCandidates("Jane Doe", "stripe.com");
    expect(c[0]).toEqual({ format: "first.last", email: "jane.doe@stripe.com" });
    expect(c.map((x) => x.email)).toContain("jdoe@stripe.com");
    expect(c.map((x) => x.email)).toContain("jane@stripe.com");
  });

  it("puts a learned format first when the caller passes an order", () => {
    const c = emailCandidates("Jane Doe", "stripe.com", ["flast", "first.last"]);
    expect(c[0]).toEqual({ format: "flast", email: "jdoe@stripe.com" });
  });

  it("never repeats an address", () => {
    const emails = emailCandidates("Ann Ann", "x.com").map((c) => c.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("returns nothing without a name or a domain", () => {
    expect(emailCandidates("", "x.com")).toEqual([]);
    expect(emailCandidates("Jane Doe", null)).toEqual([]);
  });
});

describe("accented and compound names (D3)", () => {
  it("José Álvarez becomes jose.alvarez", () => {
    expect(inferEmails("José Álvarez", "fund.fr")).toContain("jose.alvarez@fund.fr");
    expect(inferEmails("José Álvarez", "fund.fr").some((e) => e.startsWith("jos.") || e.startsWith("jos@"))).toBe(false);
  });

  it("Jean-Luc Ménard gives hyphenated and joined first names", () => {
    const emails = emailCandidates("Jean-Luc Ménard", "fund.fr").map((c) => c.email);
    expect(emails).toContain("jean-luc.menard@fund.fr");
    expect(emails).toContain("jeanluc.menard@fund.fr");
    expect(emails.some((e) => e.includes("mnard"))).toBe(false);
  });

  it("transliterates letters NFD can't split", () => {
    expect(inferEmails("Łukasz Nowak", "x.pl")).toContain("lukasz.nowak@x.pl");
    expect(normalizeNamePart("Søren")).toBe("soren");
  });

  it("drops titles and suffixes, and reads 'Last, First'", () => {
    expect(emailCandidates("Dr. John Smith", "x.com")[0].email).toBe("john.smith@x.com");
    expect(emailCandidates("John Smith Jr.", "x.com")[0].email).toBe("john.smith@x.com");
    expect(emailCandidates("Smith, John", "x.com")[0].email).toBe("john.smith@x.com");
  });

  it("never builds a local part from a lone hyphen", () => {
    expect(emailCandidates("John - Smith", "x.com").some((c) => c.email.includes("-."))).toBe(false);
  });

  it("drops apostrophes and keeps particles together", () => {
    expect(normalizeNamePart("O'Brien")).toBe("obrien");
    expect(nameTokens("Anne de la Fontaine").lasts).toEqual(["delafontaine", "fontaine"]);
  });
});

describe("domainFromEmail", () => {
  it("ignores French consumer providers", () => {
    expect(domainFromEmail("a@orange.fr")).toBeNull();
    expect(domainFromEmail("a@acmefund.com")).toBe("acmefund.com");
  });
});
