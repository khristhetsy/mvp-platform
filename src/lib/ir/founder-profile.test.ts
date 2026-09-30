import { describe, expect, it } from "vitest";
import { fitDefaultsFromProfile, founderOdooProfile } from "./founder-profile";

const raw = {
  user_id: [2, "Khris Thetsy"], x_studio_lead_type: "LinkedIn", website: "https://holomd.ai/",
  __profile: { membership: "Entrepreneur", leadSource: "LinkedIn", extra: {
    "Company Name": "Holo MD", "Entrepreneur's note": "note text", "Entrepreneur's request": "Raise-2.5-Mil",
    "Entrepreneur type of industries?": ["Healthcare", "Software", "Digital Health"],
    "Entrepreneur seeking amount of capital?": ["$1m - $10m"], "Entrepreneur annual revenue size?": ["$100k - $250k"],
    "Entrepreneur operating stage?": ["Expand Growth"], "Entrepreneur seeking type of investor(s)? ": ["Angel Investor", "Family Office", "Venture Capital", "Represent Investors"],
    "Entrepreneur business summary": "Long text",
  } },
};

describe("founderOdooProfile", () => {
  const p = founderOdooProfile(raw)!;
  it("lays the questionnaire out in Odoo's sections, with blanks kept", () => {
    expect(p.sections.map((s) => s.title)).toEqual(["Entrepreneur information", "Agent field (internal use)", "Entrepreneur"]);
    const info = p.sections[0].rows;
    expect(info.find((r) => r.label === "How did you hear about us?")?.value).toBe("LinkedIn");
    expect(info.find((r) => r.label === "Assigned agent")?.value).toBe("Khris Thetsy");
    expect(info.find((r) => r.label === "Contact preference")?.value).toBeNull();
    const ent = p.sections[2].rows;
    expect(ent.find((r) => r.label === "Seeking type of investor(s)")?.value).toEqual(["Angel Investor", "Family Office", "Venture Capital", "Represent Investors"]);
    expect(ent.find((r) => r.label === "Business summary")).toMatchObject({ value: "Long text", long: true });
    expect(p.companyName).toBe("Holo MD");
    expect(p.hasQuestionnaire).toBe(true);
  });
  it("returns null without a contact", () => { expect(founderOdooProfile(null)).toBeNull(); });
  it("gives each row the key an edit saves under", () => {
    const rows = p.sections.flatMap((s) => s.rows);
    const row = (l: string) => rows.find((r) => r.label === l)!;
    expect(row("Seeking type of investor(s)").saveKey).toBe("Entrepreneur seeking type of investor(s)? ");
    expect(row("Funding stage")).toMatchObject({ saveKey: "Entrepreneur funding stage?", kind: "list" });
    expect(row("Type of industries").saveKey).toBe("Industries");
    expect(row("Business summary").kind).toBe("text");
    expect(row("Assigned agent").saveKey).toBeNull();
  });
});

describe("founderOdooProfile with edits", () => {
  const ov = {
    Industries: ["Fintech"], "Entrepreneur funding stage?": ["Series A"], "entrepreneur annual revenue size?": [],
    "Entrepreneur business summary": ["Edited summary"], "Entrepreneur operating stage?": "not an array",
  };
  const e = founderOdooProfile(raw, ov)!;
  const val = (l: string) => e.sections.flatMap((s) => s.rows).find((r) => r.label === l)?.value;
  it("lays saved edits over the synced answers", () => {
    expect(val("Type of industries")).toEqual(["Fintech"]);
    expect(val("Funding stage")).toEqual(["Series A"]);
    expect(val("Business summary")).toBe("Edited summary");
    expect(e.industries).toEqual(["Fintech"]);
  });
  it("treats an empty edit as cleared and ignores non-array overrides", () => {
    expect(val("Annual revenue size")).toBeNull();
    expect(e.revenue).toEqual([]);
    expect(val("Operating stage")).toEqual(["Expand Growth"]);
  });
  it("reads a contact page edit saved under the synced industry label", () => {
    const c = founderOdooProfile(raw, { "Entrepreneur type of industries?": ["Software"] })!;
    expect(c.industries).toEqual(["Software"]);
  });
  it("matching follows the edits", () => {
    expect(fitDefaultsFromProfile(e, ["Healthcare", "Fintech"]).industry).toEqual(["Fintech"]);
  });
});

describe("fitDefaultsFromProfile", () => {
  it("maps the answers onto matching filters", () => {
    const d = fitDefaultsFromProfile(founderOdooProfile(raw), ["Healthcare", "Software", "Fintech"]);
    expect(d.industry).toEqual(["Healthcare", "Software"]);
    expect(d.raise).toEqual(["1m_10m"]);
    expect(d.revenue).toEqual(["under_1m"]);
    expect(d.stage).toEqual(["revenue_pre_a"]);
    expect(d.investorType?.sort()).toEqual(["angel", "family_office", "vc"]);
  });
  it("is empty without a questionnaire", () => { expect(fitDefaultsFromProfile(founderOdooProfile({}))).toEqual({}); });
});
