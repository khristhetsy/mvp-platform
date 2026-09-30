import { describe, expect, it } from "vitest";
import { defaultMergeChoice, type MergeCandidate } from "./merge-contacts-shared";

const c = (id: string, o: Partial<MergeCandidate> = {}): MergeCandidate => ({
  id, name: null, company: null, email: null, phone: null, website: null, type: "other", source: "odoo", createdOn: null,
  tags: [], profileFields: 0, profileSummary: [], refs: { irMatches: 0, lists: 0, projects: 0 }, ...o,
});

describe("defaultMergeChoice", () => {
  it("keeps the fullest profile and fills gaps from the other record", () => {
    const full = c("full", { name: "Nathan Dau", company: "Nathan Dau", email: "nathan.dau@passaiccapital.com", phone: "(206) 972-0763", type: "investor", profileFields: 6, createdOn: "2023-03-02" });
    const dupe = c("dupe", { name: "nathan.dau@passaiccapital.com", company: "Vivo Ventures", email: "nathan.dau@passaiccapital.com", createdOn: "2024-10-02" });
    const r = defaultMergeChoice([dupe, full]);
    expect(r.keepId).toBe("full");
    expect(r.fields.name).toBe("full");        // the other "name" is an email address
    expect(r.fields.company).toBe("dupe");     // kept company just repeats the person's name
    expect(r.fields.phone).toBe("full");
    expect(r.fields.profile).toBe("full");
    expect(r.fields.website).toBe("full");     // nobody has one: stays with the kept record
  });
  it("with equal profiles prefers an investor or founder, then the oldest", () => {
    expect(defaultMergeChoice([c("a", { createdOn: "2020-01-01" }), c("b", { type: "investor", createdOn: "2024-01-01" })]).keepId).toBe("b");
    expect(defaultMergeChoice([c("new", { createdOn: "2024-01-01" }), c("old", { createdOn: "2020-01-01" })]).keepId).toBe("old");
  });
  it("follows a keep record the user picked", () => {
    const full = c("full", { name: "Nathan Dau", type: "investor", profileFields: 6 });
    const dupe = c("dupe", { name: "N. Dau", company: "Vivo Ventures" });
    const r = defaultMergeChoice([full, dupe], "dupe");
    expect(r.keepId).toBe("dupe");
    expect(r.fields.name).toBe("dupe");
    expect(r.fields.profile).toBe("full");     // the profile still comes from where it is filled
  });
  it("needs two contacts", () => { expect(() => defaultMergeChoice([c("x")])).toThrow(/two/); });
});
