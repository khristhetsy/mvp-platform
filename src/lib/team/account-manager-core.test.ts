import { describe, expect, it } from "vitest";
import { isStaffProfileRole, planPremiumAssignment, planReassignment } from "@/lib/team/account-manager-core";

describe("premium account manager rules", () => {
  it("assigns the default manager to a new Premium account", () => {
    expect(planPremiumAssignment({ existingManagerIds: [], defaultManagerId: "m1", defaultIsStaff: true })).toEqual({ action: "assign", managerId: "m1" });
  });

  it("never replaces an account that already has a manager", () => {
    expect(planPremiumAssignment({ existingManagerIds: ["m2"], defaultManagerId: "m1", defaultIsStaff: true })).toEqual({ action: "skip", reason: "already_assigned" });
  });

  it("asks for a manager when none is set or the default is not staff", () => {
    expect(planPremiumAssignment({ existingManagerIds: [], defaultManagerId: null, defaultIsStaff: false })).toEqual({ action: "needs_manager", reason: "no_default" });
    expect(planPremiumAssignment({ existingManagerIds: [], defaultManagerId: "m1", defaultIsStaff: false })).toEqual({ action: "needs_manager", reason: "default_not_staff" });
  });

  it("keeps one manager per account when reassigning", () => {
    expect(planReassignment({ existingManagerIds: ["a"], newManagerId: "b" })).toEqual({ remove: ["a"], add: true });
    expect(planReassignment({ existingManagerIds: ["a"], newManagerId: "a" })).toEqual({ remove: [], add: false });
    expect(planReassignment({ existingManagerIds: ["a", "b"], newManagerId: "b" })).toEqual({ remove: ["a"], add: false });
    expect(planReassignment({ existingManagerIds: ["a", "b"], newManagerId: null })).toEqual({ remove: ["a", "b"], add: false });
    expect(planReassignment({ existingManagerIds: [], newManagerId: "c" })).toEqual({ remove: [], add: true });
  });

  it("knows which profile roles are staff", () => {
    expect(isStaffProfileRole("admin")).toBe(true);
    expect(isStaffProfileRole("Analyst")).toBe(true);
    for (const r of ["founder", "investor", "", null, undefined]) expect(isStaffProfileRole(r)).toBe(false);
  });
});
