import { describe, expect, it } from "vitest";
import { canGrantManagedIcfo, isIcfoManagerOrAdmin, isManagedIcfoPlan } from "@/lib/team/managed-icfo-core";

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
});
