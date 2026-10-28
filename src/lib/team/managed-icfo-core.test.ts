import { describe, expect, it } from "vitest";
import { canGrantManagedIcfo, isIcfoManagerOrAdmin, isManagedIcfoPlan, managedAcceptDestination, staffMayActFor } from "@/lib/team/managed-icfo-core";

describe("managed by iCFO rules", () => {
  it("lets only the owner or a managed user grant the role", () => {
    expect(canGrantManagedIcfo("owner")).toBe(true);
    expect(canGrantManagedIcfo("managed_icfo")).toBe(true);
    for (const r of ["admin", "member", "viewer", "", null, undefined]) expect(canGrantManagedIcfo(r)).toBe(false);
  });

  it("requires an active Premium plan", () => {
    expect(isManagedIcfoPlan("founder_premium", "active")).toBe(true);
    expect(isManagedIcfoPlan("founder_premium", "pending_payment")).toBe(false);
    expect(isManagedIcfoPlan("founder_professional", "active")).toBe(false);
    expect(isManagedIcfoPlan(null, null)).toBe(false);
  });

  it("lets iCFO Manager and Admin staff accept", () => {
    expect(isIcfoManagerOrAdmin({ profileRole: "admin", roleSlug: "manager", isSuperAdmin: false })).toBe(true);
    expect(isIcfoManagerOrAdmin({ profileRole: "admin", roleSlug: "admin", isSuperAdmin: false })).toBe(true);
    expect(isIcfoManagerOrAdmin({ profileRole: "admin", roleSlug: null, isSuperAdmin: false })).toBe(true);
    expect(isIcfoManagerOrAdmin({ profileRole: "analyst", roleSlug: "manager", isSuperAdmin: false })).toBe(true);
    expect(isIcfoManagerOrAdmin({ profileRole: "admin", roleSlug: "super_admin", isSuperAdmin: true })).toBe(true);
    expect(isIcfoManagerOrAdmin({ profileRole: "founder", roleSlug: null, isSuperAdmin: true })).toBe(true);
  });

  it("keeps everyone else out", () => {
    expect(isIcfoManagerOrAdmin({ profileRole: "founder", roleSlug: null, isSuperAdmin: false })).toBe(false);
    expect(isIcfoManagerOrAdmin({ profileRole: "investor", roleSlug: "manager", isSuperAdmin: false })).toBe(false);
    expect(isIcfoManagerOrAdmin({ profileRole: "analyst", roleSlug: null, isSuperAdmin: false })).toBe(false);
    expect(isIcfoManagerOrAdmin({ profileRole: "analyst", roleSlug: "regular_user", isSuperAdmin: false })).toBe(false);
    expect(isIcfoManagerOrAdmin({ profileRole: null, roleSlug: null, isSuperAdmin: false })).toBe(false);
  });

  it("lets staff act with the permission, or as Managed by iCFO on a Premium account", () => {
    expect(staffMayActFor({ hasActOnBehalfPermission: true, memberRole: null, ownerPlanActive: false })).toBe(true);
    expect(staffMayActFor({ hasActOnBehalfPermission: false, memberRole: "managed_icfo", ownerPlanActive: true })).toBe(true);
    expect(staffMayActFor({ hasActOnBehalfPermission: false, memberRole: "managed_icfo", ownerPlanActive: false })).toBe(false);
    for (const r of ["admin", "member", "owner", null, undefined]) {
      expect(staffMayActFor({ hasActOnBehalfPermission: false, memberRole: r, ownerPlanActive: true })).toBe(false);
    }
  });

  it("sends Accept access to the company page, and falls back to the admin home", () => {
    expect(managedAcceptDestination("12a73bee-941b-4c68-9068-3cc33f8e326d")).toBe("/admin/companies/12a73bee-941b-4c68-9068-3cc33f8e326d");
    expect(managedAcceptDestination("../../founder")).toBe("/admin");
    expect(managedAcceptDestination("")).toBe("/admin");
    expect(managedAcceptDestination(null)).toBe("/admin");
  });
});
