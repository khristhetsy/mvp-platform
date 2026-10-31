import { describe, expect, it } from "vitest";
import { agentRunsInDemoMode } from "./demo-mode";

const org = (purpose: string | null, email: boolean | null = true) => ({ purpose, email_dispatch_enabled: email });

describe("agentRunsInDemoMode", () => {
  it("is not demo when there is no organization", () => {
    expect(agentRunsInDemoMode(null, "sales")).toBe(false);
  });
  it("lets a sales agent on an Internal account book, even though the Accounts screen switches email dispatch off", () => {
    expect(agentRunsInDemoMode(org("internal", false), "sales")).toBe(false);
  });
  it("keeps every other agent type on an Internal account in demo mode", () => {
    for (const type of ["founder", "investor", "marketing", "ir", undefined, null]) {
      expect(agentRunsInDemoMode(org("internal"), type)).toBe(true);
    }
  });
  it("keeps a sales agent on a Demo account in demo mode", () => {
    expect(agentRunsInDemoMode(org("demo"), "sales")).toBe(true);
  });
  it("keeps an ordinary account with email dispatch off in demo mode, sales or not", () => {
    expect(agentRunsInDemoMode(org(null, false), "sales")).toBe(true);
    expect(agentRunsInDemoMode(org(null, false), "founder")).toBe(true);
  });
  it("is not demo for an ordinary account with email on", () => {
    expect(agentRunsInDemoMode(org(null, true), "founder")).toBe(false);
  });
});
