import { describe, expect, it } from "vitest";
import { ACCREDITED_OPTIONS, emptyProfile, profileAnswers, readAccredited, summaryLine } from "./profile";

describe("accredited investor question", () => {
  it("offers Yes, No and Not sure", () => {
    expect([...ACCREDITED_OPTIONS]).toEqual(["Yes", "No", "Not sure"]);
  });

  it("reads the three buttons", () => {
    expect(readAccredited("Yes")).toBe("yes");
    expect(readAccredited("No")).toBe("no");
    expect(readAccredited("Not sure")).toBe("not_sure");
  });

  it("reads typed answers", () => {
    expect(readAccredited("yes I am")).toBe("yes");
    expect(readAccredited("I am an accredited investor")).toBe("yes");
    expect(readAccredited("Nope")).toBe("no");
    expect(readAccredited("I'm not accredited")).toBe("no");
    expect(readAccredited("not yet")).toBe("no");
    expect(readAccredited("no idea")).toBe("not_sure");
    expect(readAccredited("I don't know")).toBe("not_sure");
  });

  it("does not read a question or unrelated text as an answer", () => {
    expect(readAccredited("what is an accredited investor?")).toBeNull();
    expect(readAccredited("tell me about fees")).toBeNull();
    expect(readAccredited("")).toBeNull();
  });

  it("adds accredited to the read back only for yes", () => {
    const p = emptyProfile();
    p.type = "Family office";
    p.sect = ["Fintech"];
    expect(summaryLine(p)).not.toMatch(/accredited/);
    p.accredited = "no";
    expect(summaryLine(p)).not.toMatch(/accredited/);
    p.accredited = "yes";
    expect(summaryLine(p)).toBe("So: Family office, Fintech, accredited.");
  });

  it("sends the answer to the team on the booking", () => {
    const p = emptyProfile();
    p.accredited = "not_sure";
    const rows = profileAnswers(p);
    expect(rows).toContainEqual({ label: "Accredited investor", value: "Not sure" });
    expect(rows).toContainEqual({ label: "accredited_status value", value: "not_sure" });
    expect(profileAnswers(emptyProfile()).some((r) => /ccredited/.test(r.label))).toBe(false);
  });
});
