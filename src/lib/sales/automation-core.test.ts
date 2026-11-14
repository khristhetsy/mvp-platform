import { describe, expect, it } from "vitest";
import { containsSignupLink, fromAllows, reasonText, ruleMatches } from "./automation-core";

describe("ruleMatches", () => {
  const any = { triggers: ["proposal_sent", "invite_sent"], match_mode: "any" as const, from_stage_ids: [] };
  const all = { triggers: ["signed_up", "payment_received"], match_mode: "all" as const, from_stage_ids: [] };

  it("fires an any rule on one of its triggers", () => {
    expect(ruleMatches(any, "invite_sent", new Set())).toBe(true);
  });
  it("ignores an event that is not a trigger of the rule", () => {
    expect(ruleMatches(any, "signed_up", new Set())).toBe(false);
  });
  it("waits for the other trigger on an all rule", () => {
    expect(ruleMatches(all, "payment_received", new Set())).toBe(false);
    expect(ruleMatches(all, "payment_received", new Set(["signed_up"]))).toBe(true);
  });
  it("lets payment come before signup on an all rule", () => {
    expect(ruleMatches(all, "signed_up", new Set(["payment_received"]))).toBe(true);
  });
});

describe("fromAllows", () => {
  it("allows any stage when the list is empty", () => {
    expect(fromAllows({ from_stage_ids: [] }, null)).toBe(true);
  });
  it("requires the current stage to be listed", () => {
    expect(fromAllows({ from_stage_ids: ["a", "b"] }, "b")).toBe(true);
    expect(fromAllows({ from_stage_ids: ["a", "b"] }, "c")).toBe(false);
    expect(fromAllows({ from_stage_ids: ["a"] }, null)).toBe(false);
  });
});

describe("reasonText", () => {
  it("names the event that fired", () => {
    expect(reasonText({ triggers: ["meeting_scheduled"], match_mode: "any" }, "meeting_scheduled")).toBe("meeting scheduled");
  });
  it("lists every trigger of an all rule", () => {
    expect(reasonText({ triggers: ["signed_up", "payment_received"], match_mode: "all" }, "payment_received")).toBe("all of these happened: account signed up and payment received");
  });
});

describe("containsSignupLink", () => {
  const hosts = ["icapos.com", "app.example.com"];
  it("finds the signup page on our host", () => {
    expect(containsSignupLink('<a href="https://icapos.com/start">Join</a>', hosts)).toBe(true);
    expect(containsSignupLink("go to https://www.icapos.com/start?ref=x now", hosts)).toBe(true);
    expect(containsSignupLink("https://app.example.com/start", hosts)).toBe(true);
  });
  it("ignores other pages and other sites", () => {
    expect(containsSignupLink("https://icapos.com/start-here", hosts)).toBe(false);
    expect(containsSignupLink("https://icapos.com/pricing", hosts)).toBe(false);
    expect(containsSignupLink("https://other.com/start", hosts)).toBe(false);
    expect(containsSignupLink(null, hosts)).toBe(false);
  });
});
