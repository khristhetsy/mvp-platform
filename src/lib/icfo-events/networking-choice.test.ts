/**
 * Saying no to networking, and being asked.
 */
import { describe, it, expect } from "vitest";
import { isNetworkingOptOut, withNetworkingChoice } from "@/lib/icfo-events/networking-choice-core";
import { renderAttendeeEmail } from "@/lib/icfo-events/invitations/emails";

describe("the networking choice", () => {
  it("treats silence as in", () => {
    expect(isNetworkingOptOut({ name: "Ann" })).toBe(false);
    expect(isNetworkingOptOut(null)).toBe(false);
    expect(isNetworkingOptOut(undefined)).toBe(false);
  });

  it("a no sets the flag and keeps every other answer", () => {
    const next = withNetworkingChoice({ name: "Ann", sectors: ["FinTech"] }, false);
    expect(isNetworkingOptOut(next)).toBe(true);
    expect(next.name).toBe("Ann");
    expect(next.sectors).toEqual(["FinTech"]);
  });

  it("a yes removes the flag", () => {
    const out = withNetworkingChoice({ name: "Ann" }, false);
    expect(isNetworkingOptOut(withNetworkingChoice(out, true))).toBe(false);
  });
});

const base = {
  step: "confirm" as const,
  attendeeType: "investor",
  firstName: "Andrew",
  event: { title: "iCFO PE Expo", dateLabel: "Nov 17", url: "https://icapos.com/events/x" },
  activities: [],
  signUpUrl: "https://icapos.com/signup",
};

describe("the registration email", () => {
  it("asks the question with a yes and a no link when the role is matched", () => {
    const { html } = renderAttendeeEmail({ ...base, networkingUrl: "https://icapos.com/e/networking/tok" });
    expect(html).toContain("Meet founders at this event?");
    expect(html).toContain("https://icapos.com/e/networking/tok?a=yes");
    expect(html).toContain("https://icapos.com/e/networking/tok?a=no");
    expect(html).toContain("Doing nothing keeps you in");
  });

  it("asks founders about investors", () => {
    const { html } = renderAttendeeEmail({ ...base, attendeeType: "founder", networkingUrl: "https://icapos.com/e/networking/tok" });
    expect(html).toContain("Meet investors at this event?");
  });

  it("leaves the question out when there is no link", () => {
    const { html } = renderAttendeeEmail({ ...base, networkingUrl: null });
    expect(html).not.toContain("Meet founders");
    expect(html).toContain("You're registered");
  });

  it("does not touch the other steps", () => {
    const { html } = renderAttendeeEmail({ ...base, step: "reminder_1d", networkingUrl: "https://icapos.com/e/networking/tok" });
    expect(html).not.toContain("Meet founders");
  });
});
