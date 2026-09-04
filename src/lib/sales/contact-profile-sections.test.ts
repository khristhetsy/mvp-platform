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
