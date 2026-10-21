import { describe, expect, it } from "vitest";
import { blockingFallbackBody, blockingPrompt, blockingSubject, nextFridayLabel, splitFindings } from "@/lib/founder-outreach/reach-out-brief";

const FACTS = [
  "Capital Readiness Rating: 98/100 · gate cleared. Scores 98/100 on the Pre-seed profile.",
  "Outreach: Automated running (5 sent) · Manual not started · 1 of 2. Automated is running (5 sent). No manual email has gone out, and Outreach completes only when both have.",
  "Manual: 0 sent",
  "Fix (1 of 2) [Founder · Outreach › Manual @ Outreach]: Founder adds recipients (My contacts or investors they already know) and sends the first manual email.",
  "Fix (gate) [Automatic @ Outreach]: Manual outreach reminders run with the daily founder nudges and stop at the first manual send.",
  "Investor CRM: no investor has reached Interested. No investor in the pipeline has reached the Interested stage, which is what Closing needs.",
  "Fix (1 of 1) [Downstream @ Investor CRM]: Outreach has to run first; this follows from it.",
  "Fix (+9) [Founder @ Documents]: Improve Financial model — scoring 3 of 12 at Pre-seed.",
  "Fix (+4) [Staff @ Documents]: Send the template if the founder has not built one.",
];

describe("reach out brief", () => {
  it("keeps founder owned fixes as actions, downstream as follow ons, and drops automatic and staff fixes", () => {
    const b = splitFindings(FACTS);
    expect(b.actions.map((a) => a.impact)).toEqual(["1 of 2", "+9"]);
    expect(b.actions[0].where).toBe("Outreach › Manual");
    expect(b.actions[1].where).toBe("Documents");
    expect(b.follows).toEqual(["Outreach has to run first; this follows from it."]);
    expect(b.status).toHaveLength(4);
    expect(JSON.stringify(b)).not.toContain("reminders");
    expect(JSON.stringify(b)).not.toContain("template");
  });

  it("ranks the gate above points above fractions", () => {
    const b = splitFindings([
      "Fix (+3) [Founder]: a",
      "Fix (gate) [Founder]: b",
      "Fix (1 of 2) [Founder]: c",
      "Fix (+40) [Founder]: d",
    ]);
    expect(b.actions.map((a) => a.text)).toEqual(["b", "c", "d", "a"]);
  });

  it("names the first action in the subject", () => {
    const b = splitFindings(FACTS);
    expect(blockingSubject("Jane", b, "Marketing")).toBe("Jane, 2 things to do this week: add recipients and send the first manual email");
    expect(blockingSubject("Jane", splitFindings([]), "Marketing")).toBe("A couple of things blocking your iCapOS Marketing");
  });

  it("writes the fallback in the same shape as the prompt asks for", () => {
    const body = blockingFallbackBody("Jane", splitFindings(FACTS), "Marketing", "Friday, Oct 24");
    expect(body).toContain("What needs to get done\n1. ");
    expect(body).toContain("Where: Outreach › Manual.");
    expect(body).toContain("What follows on its own\n- Outreach has to run first");
    expect(body).toContain("by Friday, Oct 24?");
    expect(body).not.toContain("reminders");
  });

  it("puts the action list and the due date in the prompt and keeps staff mechanics out", () => {
    const p = blockingPrompt({ founderName: "Jane Founder", companyName: "Acme", stage: "Marketing", brief: splitFindings(FACTS), dueLabel: "Friday, Oct 24" });
    expect(p).toContain("What needs to get done");
    expect(p).toContain("1. Founder adds recipients");
    expect(p).toContain("(where: Outreach › Manual)");
    expect(p).toContain("by Friday, Oct 24");
    expect(p).not.toContain("daily founder nudges");
  });

  it("picks the coming Friday in the founder's zone, and the same day when it is Friday morning", () => {
    expect(nextFridayLabel(new Date("2026-10-21T12:00:00Z"), "America/Los_Angeles")).toBe("Friday, Oct 23");
    expect(nextFridayLabel(new Date("2026-10-23T15:00:00Z"), "America/Los_Angeles")).toBe("Friday, Oct 23"); // 8am PT Friday
    expect(nextFridayLabel(new Date("2026-10-24T01:00:00Z"), "America/Los_Angeles")).toBe("Friday, Oct 30"); // 6pm PT Friday
  });
});
