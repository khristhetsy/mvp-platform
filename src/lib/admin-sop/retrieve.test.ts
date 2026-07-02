import { describe, it, expect } from "vitest";
import { ADMIN_SOPS } from "./library";
import { isAdminSopIntent, resolveVisibility, visibleSops, retrieveSops } from "./retrieve";
import type { SopViewer } from "./types";

const superAdmin: SopViewer = { permissions: [], isSuperAdmin: true };
const legacyStaff: SopViewer = {
  // everything except manage_users / assign_roles (mirrors LEGACY_STAFF_PERMISSIONS)
  permissions: ["view_audit_logs", "manage_billing", "manage_compliance", "manage_spvs", "manage_investors", "manage_companies"],
  isSuperAdmin: false,
};
const analystNoUsers: SopViewer = { permissions: ["view_audit_logs"], isSuperAdmin: false };

describe("isAdminSopIntent", () => {
  it("detects how-to phrasing", () => {
    expect(isAdminSopIntent("How do I delete a user?")).toBe(true);
    expect(isAdminSopIntent("what's the process for onboarding a founder")).toBe(true);
    expect(isAdminSopIntent("steps to deactivate an account")).toBe(true);
    expect(isAdminSopIntent("show me the SOP for invites")).toBe(true);
  });

  it("detects verb + noun operations questions", () => {
    expect(isAdminSopIntent("deactivate a user account")).toBe(true);
    expect(isAdminSopIntent("rotate the service role key")).toBe(true);
  });

  it("ignores unrelated chatter", () => {
    // "how is" does not match the precise how-to patterns (how do/can/to/would).
    expect(isAdminSopIntent("how is the weather today")).toBe(false);
    expect(isAdminSopIntent("thanks, that's great")).toBe(false);
    expect(isAdminSopIntent("show me overdue actions")).toBe(false);
  });
});

describe("retrieveSops", () => {
  it("ranks the delete SOP top for a delete question", () => {
    const results = retrieveSops("how do I permanently delete a user?", superAdmin);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].sop.id).toBe(7);
  });

  it("ranks onboarding SOP for an onboarding question", () => {
    const results = retrieveSops("how does founder onboarding work?", superAdmin);
    expect(results[0].sop.id).toBe(1);
  });

  it("returns nothing for an unrelated query", () => {
    const results = retrieveSops("the weather is nice", superAdmin);
    expect(results).toHaveLength(0);
  });

  it("hides super-admin-only SOPs from non-super-admins", () => {
    const results = retrieveSops("how do I rotate secrets and keys?", legacyStaff);
    // SOP 43 is superAdminOnly — must not surface for legacy staff
    expect(results.find((r) => r.sop.id === 43)).toBeUndefined();
  });

  it("surfaces super-admin-only SOPs for super admins", () => {
    const results = retrieveSops("how do I rotate secrets and keys?", superAdmin);
    expect(results[0].sop.id).toBe(43);
  });

  it("marks a permission-gap SOP as locked but still returns it", () => {
    const results = retrieveSops("how do I delete a user?", analystNoUsers);
    const del = results.find((r) => r.sop.id === 7);
    expect(del).toBeDefined();
    expect(del?.locked).toBe(true);
  });
});

describe("resolveVisibility / visibleSops", () => {
  it("hides super-admin-only entries from others entirely", () => {
    const breakGlass = ADMIN_SOPS.find((s) => s.id === 51)!;
    expect(resolveVisibility(breakGlass, legacyStaff).visible).toBe(false);
    expect(resolveVisibility(breakGlass, superAdmin).visible).toBe(true);
  });

  it("locks (but shows) permission gaps", () => {
    const deleteSop = ADMIN_SOPS.find((s) => s.id === 7)!;
    const v = resolveVisibility(deleteSop, analystNoUsers);
    expect(v.visible).toBe(true);
    expect(v.locked).toBe(true);
  });

  it("super admin sees every SOP unlocked", () => {
    const visible = visibleSops(superAdmin);
    expect(visible).toHaveLength(ADMIN_SOPS.length);
    expect(visible.every((e) => !e.locked)).toBe(true);
  });

  it("general-staff SOPs are never locked", () => {
    const escalation = ADMIN_SOPS.find((s) => s.id === 52)!; // permission: null
    expect(resolveVisibility(escalation, analystNoUsers).locked).toBe(false);
  });
});

describe("library integrity", () => {
  it("has 64 SOPs with unique sequential ids", () => {
    expect(ADMIN_SOPS).toHaveLength(64);
    const ids = ADMIN_SOPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(64);
    expect(Math.min(...ids)).toBe(1);
    expect(Math.max(...ids)).toBe(64);
  });

  it("every SOP has at least one step and keyword", () => {
    for (const sop of ADMIN_SOPS) {
      expect(sop.steps.length, `SOP ${sop.id} steps`).toBeGreaterThan(0);
      expect(sop.keywords.length, `SOP ${sop.id} keywords`).toBeGreaterThan(0);
    }
  });
});
