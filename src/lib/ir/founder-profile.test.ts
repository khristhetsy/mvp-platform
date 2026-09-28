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
