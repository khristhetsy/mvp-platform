import { describe, it, expect } from "vitest";
import { groupContactProfile } from "./contact-profile-sections";

describe("groupContactProfile", () => {
  it("titles and sections an investor contact", () => {
    const p = groupContactProfile([
      { label: "Investor contact preference", values: ["Verified"] },
      { label: "Active investor", values: ["5-Excellent"] },
      { label: "Investor investment size?", values: ["$250k - $500k"] },
      { label: "Investor's note", values: ["hot lead"] },
    ]);
    expect(p.title).toBe("Investor Profile");
    expect(p.type).toBe("investor");
    const titles = p.sections.map((s) => s.title);
    expect(titles).toContain("Investor information");
    expect(titles).toContain("Investor rating");
    expect(titles).toContain("Investor thesis");
    expect(titles).toContain("Agent field (internal)");
  });

  it("maps the Odoo operational-stage label to the Operating stage field", () => {
    const p = groupContactProfile([
      { label: "Investor preferences for type(s) of company operational stage?", values: ["Expand Growth"] },
    ]);
    const thesis = p.sections.find((s) => s.title === "Investor thesis");
    const opStage = thesis?.fields.find((f) => f.label === "Operating stage");
    expect(opStage?.values).toEqual(["Expand Growth"]);
    // And it should NOT leak into "Other details".
    expect(p.sections.find((s) => s.title === "Other details")).toBeUndefined();
  });

  it("titles and sections a founder contact", () => {
    const p = groupContactProfile([
      { label: "Entrepreneur: iCFO capital partner", values: ["Khris Thetsy"] },
      { label: "Entrepreneur seeking amount of capital?", values: ["$1m - $10m"] },
      { label: "Entrepreneur's note", values: ["2-Million"] },
    ]);
    expect(p.title).toBe("Founder Profile");
    expect(p.type).toBe("founder");
    expect(p.sections.map((s) => s.title)).toEqual(
      expect.arrayContaining(["Entrepreneur information", "Seeking", "Agent field (internal)"]),
    );
  });

  it("falls back to a generic list for non-typed contacts", () => {
    const p = groupContactProfile([{ label: "Random field", values: ["x"] }]);
    expect(p.type).toBe("generic");
    expect(p.title).toBe("Additional details");
  });

  it("titles by membership and shows the full field list even with no synced data", () => {
    const p = groupContactProfile([], "Entrepreneur");
    expect(p.title).toBe("Founder Profile");
    expect(p.type).toBe("founder");
    const seeking = p.sections.find((s) => s.title === "Seeking");
    expect(seeking?.fields.map((f) => f.label)).toContain("Amount of capital");
    expect(seeking?.fields.every((f) => f.values.length === 0)).toBe(true);
  });

  it("membership wins over field labels", () => {
    const p = groupContactProfile([{ label: "Investor's note", values: ["x"] }], "Investor");
    expect(p.title).toBe("Investor Profile");
  });
});

describe("operating stage — one row, two possible labels", () => {
  const investor = (extra: Array<{ label: string; values: string[] }>) =>
    groupContactProfile(extra, "Investor");
  const stageRow = (extra: Array<{ label: string; values: string[] }>) =>
    investor(extra).sections.flatMap((s) => s.fields).find((f) => f.label === "Operating stage");

  it("shows a value stored under the entrepreneur-side label", () => {
    expect(stageRow([{ label: "Entrepreneur operating stage?", values: ["Startup"] }])?.values).toEqual(["Startup"]);
  });
  it("shows a value stored under the investor-side label", () => {
    expect(stageRow([{ label: "Investor preferences for type(s) of company operational stage?", values: ["Midsize Company"] }])?.values).toEqual(["Midsize Company"]);
  });
  it("unions both when a contact carries each, without duplicating", () => {
    const row = stageRow([
      { label: "Entrepreneur operating stage?", values: ["Startup", "Prototype"] },
      { label: "Investor preferences for type(s) of company operational stage?", values: ["Prototype", "Midsize Company"] },
    ]);
    expect(row?.values).toEqual(["Startup", "Prototype", "Midsize Company"]);
  });
  it("saves to the canonical label so edits stop widening the split", () => {
    const row = stageRow([
      { label: "Investor preferences for type(s) of company operational stage?", values: ["Midsize Company"] },
      { label: "Entrepreneur operating stage?", values: ["Startup"] },
    ]);
    expect(row?.saveKey).toBe("Entrepreneur operating stage?");
  });
  it("renders exactly one stage row, not two", () => {
    const labels = investor([{ label: "Entrepreneur operating stage?", values: ["Startup"] }])
      .sections.flatMap((s) => s.fields).map((f) => f.label)
      .filter((l) => l.toLowerCase().includes("stage"));
    expect(labels).toEqual(["Operating stage"]);
  });
  it("leaves neither label stranded in Other details", () => {
    const other = investor([
      { label: "Entrepreneur operating stage?", values: ["Startup"] },
      { label: "Investor preferences for type(s) of company operational stage?", values: ["Midsize Company"] },
    ]).sections.find((s) => s.title === "Other details");
    expect(other?.fields.some((f) => f.label.toLowerCase().includes("stage")) ?? false).toBe(false);
  });
});
