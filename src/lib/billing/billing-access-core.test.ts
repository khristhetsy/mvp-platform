import { describe, expect, it } from "vitest";
import { roleCanManageBilling } from "@/lib/billing/billing-access-core";

describe("roleCanManageBilling", () => {
  it("allows the owner", () => {
    expect(roleCanManageBilling("owner")).toBe(true);
    expect(roleCanManageBilling(" Owner ")).toBe(true);
  });

  it("allows a person with no membership row (founder via founder_id, or staff)", () => {
    expect(roleCanManageBilling(null)).toBe(true);
    expect(roleCanManageBilling(undefined)).toBe(true);
    expect(roleCanManageBilling("")).toBe(true);
  });

  it("blocks every other company role", () => {
    for (const role of ["admin", "member", "managed_icfo", "viewer", "anything_else"]) {
      expect(roleCanManageBilling(role)).toBe(false);
    }
  });
});
