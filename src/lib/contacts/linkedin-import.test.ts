import { describe, expect, it } from "vitest";
import { classifyConnection, companyKey, decideMatch, emailBelongsTo, isGenericEmail, linkedinSlug, nameKey, parseConnectionsCsv, phoneKey } from "./linkedin-import";

const FILE = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Alif,Saleh,https://www.linkedin.com/in/alif-saleh-753a061,,28bio,Chief Executive Officer,02 Sep 2026
,,,,,,01 Sep 2026
Marc,Leroy,https://www.linkedin.com/in/MarcLeroy/,marc@atlas.vc,Atlas Capital,Principal,01 Sep 2026
Marc,Leroy,https://www.linkedin.com/in/marcleroy,,Atlas Capital,Principal,01 Sep 2026
Jo,"Smith, Jr.",https://www.linkedin.com/in/jo-smith,,"Acme, Inc.",Engineer,30 Aug 2026
`;

describe("parseConnectionsCsv", () => {
  it("skips the notes, hidden members and repeated profiles", () => {
    const p = parseConnectionsCsv(FILE);
    expect(p.rows.map((r) => r.slug)).toEqual(["alif-saleh-753a061", "marcleroy", "jo-smith"]);
    expect(p.hidden).toBe(1);
    expect(p.repeated).toBe(1);
    expect(p.rows[1]).toMatchObject({ email: "marc@atlas.vc", company: "Atlas Capital", group: "investor" });
    expect(p.rows[0].group).toBe("founder");
    expect(p.rows[2]).toMatchObject({ name: "Jo Smith, Jr.", company: "Acme, Inc.", group: "other" });
  });
  it("rejects a file that isn't Connections.csv", () => {
    expect(() => parseConnectionsCsv("Name,Email\nA,b@c.com\n")).toThrow(/Connections/);
  });
});

describe("keys", () => {
  it("normalise slugs, names, phones and companies", () => {
    expect(linkedinSlug("https://www.linkedin.com/in/Ana-Ruiz-12/?x=1")).toBe("ana-ruiz-12");
    expect(linkedinSlug("https://example.com")).toBeNull();
    expect(nameKey("  José   O'Neil ")).toBe("jos o neil");
    expect(phoneKey("+1 (212) 555-0140")).toBe("125550140");
    expect(phoneKey("555")).toBeNull();
    expect(companyKey("Acme, Inc.")).toBe("acme");
  });
});

describe("classifyConnection", () => {
  it("puts investors before founders", () => {
    expect(classifyConnection("Managing Partner", "Northbay Ventures")).toBe("investor");
    expect(classifyConnection("Founder and Angel Investor", "Self")).toBe("investor");
    expect(classifyConnection("Co-Founder & CEO", "Helio Bio")).toBe("founder");
    expect(classifyConnection("Partner", "Smith Law LLP")).toBe("other");
  });
});

describe("emails", () => {
  it("tells company mailboxes from personal ones", () => {
    expect(isGenericEmail("info@atlas.com")).toBe(true);
    expect(emailBelongsTo("ana.ruiz@northbay.vc", "Ana", "Ruiz")).toBe(true);
    expect(emailBelongsTo("mleroy@atlas.com", "Marc", "Leroy")).toBe(true);
    expect(emailBelongsTo("bob@atlas.com", "Marc", "Leroy")).toBe(false);
    expect(emailBelongsTo("info@atlas.com", "Info", "Leroy")).toBe(false);
  });
});

describe("decideMatch", () => {
  it("prefers LinkedIn, then email, then name", () => {
    const d = decideMatch([
      { kind: "name", id: "a", name: "X", company: null },
      { kind: "email", id: "b", name: "X", company: null },
    ]);
    expect(d).toMatchObject({ kind: "email", defaultTarget: "b" });
  });
  it("skips by default when several contacts share the name", () => {
    const d = decideMatch([
      { kind: "name", id: "a", name: "X", company: null },
      { kind: "name", id: "b", name: "X", company: null },
    ]);
    expect(d).toMatchObject({ kind: "name", defaultTarget: null });
    expect(d.candidates).toHaveLength(2);
  });
  it("is new when nothing matches", () => {
    expect(decideMatch([]).kind).toBe("new");
  });
});
