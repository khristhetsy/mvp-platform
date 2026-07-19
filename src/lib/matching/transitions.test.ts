import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, isTerminal, InvalidTransitionError } from "./transitions";

describe("match transitions", () => {
  it("allows the happy path", () => {
    expect(canTransition("suggested", "investor_notified", "system")).toBe(true);
    expect(canTransition("investor_notified", "investor_interested", "investor")).toBe(true);
    expect(canTransition("investor_interested", "founder_approved", "founder")).toBe(true);
    expect(canTransition("founder_approved", "introduced", "system")).toBe(true);
  });

  it("rejects skipping straight to introduced", () => {
    expect(canTransition("suggested", "introduced")).toBe(false);
    expect(() => assertTransition("suggested", "introduced")).toThrow(InvalidTransitionError);
  });

  it("enforces the acting party", () => {
    // A founder cannot express investor interest.
    expect(canTransition("investor_notified", "investor_interested", "founder")).toBe(false);
    // An investor cannot approve on the founder's behalf.
    expect(canTransition("investor_interested", "founder_approved", "investor")).toBe(false);
  });

  it("treats declines and expiry as terminal", () => {
    expect(isTerminal("declined_by_investor")).toBe(true);
    expect(isTerminal("declined_by_founder")).toBe(true);
    expect(isTerminal("expired")).toBe(true);
    expect(isTerminal("introduced")).toBe(true);
    expect(canTransition("declined_by_investor", "investor_interested")).toBe(false);
  });

  it("allows expiry from any open state", () => {
    expect(canTransition("investor_notified", "expired", "system")).toBe(true);
    expect(canTransition("investor_interested", "expired", "system")).toBe(true);
    expect(canTransition("founder_approved", "expired", "system")).toBe(true);
  });
});
