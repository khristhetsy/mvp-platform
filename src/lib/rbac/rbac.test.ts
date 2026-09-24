import { describe, expect, it, vi } from "vitest";

// effective-permissions pulls in the super-admin helpers, which import the
// server/service-role clients. Nothing here touches them.
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/data/audit", () => ({ writeAuditLog: vi.fn() }));

import {
  INTERNAL_PERMISSIONS,
  INTERNAL_ROLE_SLUGS,
  LEGACY_STAFF_PERMISSIONS,
  SUPER_ADMIN_ONLY_PERMISSIONS,
  isInternalPermission,
  isInternalRoleSlug,
  type InternalPermission,
  type InternalRoleSlug,
} from "@/lib/rbac/constants";
import {
  actorCanGrantPermission,
  actorCanManageTargetRole,
  canUser,
  getEffectivePermissions,
  isSuperAdmin,
} from "@/lib/rbac/effective-permissions";
import { previewEffectivePermissions } from "@/lib/rbac/internal-users";
import { DASHBOARD_CARDS, canActOnCard, canSeeCard } from "@/lib/rbac/dashboard-cards";
import type { InternalPermissionRow, InternalRoleRow } from "@/lib/rbac/types";
import type { UserRole } from "@/lib/supabase/types";

// ── Fixture catalog ──────────────────────────────────────────────────────────
// A role → permission grant table shaped like the seeded one: each rank holds
// everything the rank below holds, plus its own additions.
const ROLE_GRANTS: Record<Exclude<InternalRoleSlug, "super_admin">, InternalPermission[]> = {
  regular_user: ["view_admin_dashboard", "view_actions", "view_events"],
  manager: ["view_admin_dashboard", "view_actions", "view_events", "manage_actions", "manage_companies", "manage_crm"],
  admin: [...LEGACY_STAFF_PERMISSIONS],
};

const roles: InternalRoleRow[] = INTERNAL_ROLE_SLUGS.map((slug, i) => ({
  id: `role-${slug}`,
  slug,
  label: slug,
  description: null,
  rank: (i + 1) * 10,
  is_active: true,
  created_at: "2026-01-01",
}));

const permissions: InternalPermissionRow[] = INTERNAL_PERMISSIONS.map((slug) => ({
  id: `perm-${slug}`,
  slug,
  label: slug,
  description: null,
  created_at: "2026-01-01",
}));

const rolePermissionMap = new Map<InternalRoleSlug, Set<InternalPermission>>(
  Object.entries(ROLE_GRANTS).map(([slug, perms]) => [slug as InternalRoleSlug, new Set(perms)]),
);

const catalog = { roles, permissions, rolePermissionMap };

type ClientState = {
  userRole: { role_id: string; is_active: boolean } | null;
  overrides: Array<{ permission: InternalPermission; granted: boolean }>;
  profile?: { role: string | null; is_super_admin: boolean | null } | null;
};

function fakeClient(s: ClientState) {
  const from = vi.fn((table: string) => {
    if (table === "internal_user_roles") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: s.userRole
            ? { user_id: "u", assigned_at: "2026-01-01", assigned_by: null, ...s.userRole }
            : null,
          error: null,
        }),
      };
      return chain;
    }
    if (table === "internal_user_permission_overrides") {
      const chain = {
        select: () => chain,
        eq: async () => ({
          data: s.overrides.map((o) => ({ permission_id: `perm-${o.permission}`, granted: o.granted })),
          error: null,
        }),
      };
      return chain;
    }
    if (table === "profiles") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: s.profile ?? null, error: null }),
      };
      return chain;
    }
    throw new Error(`unexpected table ${table}`);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any;
}

const WORKSPACE_ROLES: UserRole[] = ["founder", "investor", "admin", "analyst"];
const STAFF_ROLES: UserRole[] = ["admin", "analyst"];

// ── Workspace role × RBAC state ──────────────────────────────────────────────

describe("getEffectivePermissions — workspace roles without an RBAC row", () => {
  for (const role of WORKSPACE_ROLES) {
    const staff = STAFF_ROLES.includes(role);

    it(`${role}: ${staff ? "legacy staff permissions" : "no permissions"}`, async () => {
      const result = await getEffectivePermissions(
        fakeClient({ userRole: null, overrides: [] }),
        "u",
        { role, is_super_admin: false },
        catalog,
      );
      expect(result.isSuperAdmin).toBe(false);
      expect(result.roleSlug).toBeNull();
      expect(result.legacyFallback).toBe(staff);
      expect(result.isActive).toBe(staff);
      expect(result.permissions).toEqual(staff ? LEGACY_STAFF_PERMISSIONS : []);
    });

    for (const permission of INTERNAL_PERMISSIONS) {
      const expected = staff && LEGACY_STAFF_PERMISSIONS.includes(permission);
      it(`${role} (no RBAC row) ${expected ? "can" : "cannot"} ${permission}`, async () => {
        const client = fakeClient({ userRole: null, overrides: [] });
        const allowed = await getEffectivePermissions(client, "u", { role, is_super_admin: false }, catalog).then(
          (r) => r.isActive && r.permissions.includes(permission),
        );
        expect(allowed).toBe(expected);
      });
    }
  }

  it("legacy staff never get manage_users, assign_roles or act_on_behalf", () => {
    for (const p of ["manage_users", "assign_roles", "act_on_behalf"] as const) {
      expect(LEGACY_STAFF_PERMISSIONS).not.toContain(p);
    }
  });

  it("matches the legacy staff role case-insensitively", async () => {
    const result = await getEffectivePermissions(
      fakeClient({ userRole: null, overrides: [] }),
      "u",
      { role: "Analyst" as UserRole, is_super_admin: false },
      catalog,
    );
    expect(result.legacyFallback).toBe(true);
  });

  it("an inactive RBAC row falls back to legacy for staff and nothing for others", async () => {
    for (const role of WORKSPACE_ROLES) {
      const result = await getEffectivePermissions(
        fakeClient({ userRole: { role_id: "role-admin", is_active: false }, overrides: [] }),
        "u",
        { role, is_super_admin: false },
        catalog,
      );
      if (STAFF_ROLES.includes(role)) {
        expect(result.permissions).toEqual(LEGACY_STAFF_PERMISSIONS);
      } else {
        expect(result.permissions).toEqual([]);
        expect(result.isActive).toBe(false);
      }
    }
  });
});

describe("getEffectivePermissions — every internal role slug × every permission", () => {
  for (const slug of INTERNAL_ROLE_SLUGS) {
    const granted = new Set<InternalPermission>(
      slug === "super_admin" ? INTERNAL_PERMISSIONS : ROLE_GRANTS[slug],
    );

    for (const workspaceRole of WORKSPACE_ROLES) {
      it(`${slug} on a ${workspaceRole} profile gets exactly its role grants`, async () => {
        const result = await getEffectivePermissions(
          fakeClient({ userRole: { role_id: `role-${slug}`, is_active: true }, overrides: [] }),
          "u",
          { role: workspaceRole, is_super_admin: false },
          catalog,
        );
        expect(result.roleSlug).toBe(slug);
        expect(result.isSuperAdmin).toBe(slug === "super_admin");
        expect(result.legacyFallback).toBe(false);
        expect(new Set(result.permissions)).toEqual(granted);
      });
    }

    for (const permission of INTERNAL_PERMISSIONS) {
      const expected = granted.has(permission);
      it(`${slug} ${expected ? "can" : "cannot"} ${permission}`, async () => {
        const result = await getEffectivePermissions(
          fakeClient({ userRole: { role_id: `role-${slug}`, is_active: true }, overrides: [] }),
          "u",
          { role: "admin", is_super_admin: false },
          catalog,
        );
        expect(result.permissions.includes(permission)).toBe(expected);
      });
    }
  }

  it("super-admin-only permissions are held by super_admin and no other seeded role", () => {
    for (const p of SUPER_ADMIN_ONLY_PERMISSIONS) {
      for (const slug of ["regular_user", "manager", "admin"] as const) {
        expect(ROLE_GRANTS[slug]).not.toContain(p);
      }
    }
  });

  it("an RBAC row pointing at an unknown role grants nothing", async () => {
    const result = await getEffectivePermissions(
      fakeClient({ userRole: { role_id: "role-missing", is_active: true }, overrides: [] }),
      "u",
      { role: "admin", is_super_admin: false },
      catalog,
    );
    expect(result.roleSlug).toBeNull();
    expect(result.permissions).toEqual([]);
  });

  it("returns permissions in catalog order", async () => {
    const result = await getEffectivePermissions(
      fakeClient({ userRole: { role_id: "role-manager", is_active: true }, overrides: [] }),
      "u",
      { role: "admin", is_super_admin: false },
      catalog,
    );
    expect(result.permissions).toEqual(INTERNAL_PERMISSIONS.filter((p) => ROLE_GRANTS.manager.includes(p)));
  });
});

describe("getEffectivePermissions — overrides", () => {
  it("a granted override adds a permission the role lacks", async () => {
    const result = await getEffectivePermissions(
      fakeClient({
        userRole: { role_id: "role-regular_user", is_active: true },
        overrides: [{ permission: "manage_billing", granted: true }],
      }),
      "u",
      { role: "analyst", is_super_admin: false },
      catalog,
    );
    expect(result.permissions).toContain("manage_billing");
  });

  it("a revoked override removes a permission the role grants", async () => {
    const result = await getEffectivePermissions(
      fakeClient({
        userRole: { role_id: "role-manager", is_active: true },
        overrides: [{ permission: "manage_crm", granted: false }],
      }),
      "u",
      { role: "analyst", is_super_admin: false },
      catalog,
    );
    expect(result.permissions).not.toContain("manage_crm");
    expect(result.permissions).toContain("manage_companies");
  });

  it("overrides cannot take anything away from a super_admin role", async () => {
    const result = await getEffectivePermissions(
      fakeClient({
        userRole: { role_id: "role-super_admin", is_active: true },
        overrides: [{ permission: "manage_users", granted: false }],
      }),
      "u",
      { role: "admin", is_super_admin: false },
      catalog,
    );
    expect(result.permissions).toEqual([...INTERNAL_PERMISSIONS]);
  });
});

describe("super admin by profile", () => {
  for (const role of WORKSPACE_ROLES) {
    it(`${role} with is_super_admin holds every permission regardless of RBAC row`, async () => {
      const result = await getEffectivePermissions(
        fakeClient({ userRole: { role_id: "role-regular_user", is_active: false }, overrides: [] }),
        "u",
        { role, is_super_admin: true },
        catalog,
      );
      expect(result.isSuperAdmin).toBe(true);
      expect(result.permissions).toEqual([...INTERNAL_PERMISSIONS]);
    });
  }

  it("isSuperAdmin accepts the flag or a super_admin role string", () => {
    expect(isSuperAdmin({ role: "founder", is_super_admin: true })).toBe(true);
    expect(isSuperAdmin({ role: "SUPER_ADMIN", is_super_admin: false })).toBe(true);
    for (const role of WORKSPACE_ROLES) {
      expect(isSuperAdmin({ role, is_super_admin: false })).toBe(false);
      expect(isSuperAdmin({ role, is_super_admin: null })).toBe(false);
    }
  });

  it("canUser loads the profile when none is passed", async () => {
    const client = fakeClient({ userRole: null, overrides: [], profile: { role: "founder", is_super_admin: true } });
    expect(await canUser(client, "u", "manage_users")).toBe(true);
  });
});

// ── Delegation rules ─────────────────────────────────────────────────────────

describe("actorCanManageTargetRole — every actor × every target", () => {
  const RANK: Record<InternalRoleSlug, number> = { regular_user: 1, manager: 2, admin: 3, super_admin: 4 };
  const actors: Array<InternalRoleSlug | null> = [null, ...INTERNAL_ROLE_SLUGS];

  for (const actor of actors) {
    for (const target of INTERNAL_ROLE_SLUGS) {
      const expected = actor !== null && target !== "super_admin" && RANK[actor] > RANK[target];
      it(`${actor ?? "no role"} ${expected ? "can" : "cannot"} manage ${target}`, () => {
        expect(actorCanManageTargetRole(actor, false, target)).toBe(expected);
      });
    }
  }

  it("a super admin actor can manage every target, including super_admin", () => {
    for (const target of INTERNAL_ROLE_SLUGS) {
      expect(actorCanManageTargetRole(null, true, target)).toBe(true);
    }
  });
});

describe("actorCanGrantPermission", () => {
  for (const permission of INTERNAL_PERMISSIONS) {
    it(`only an actor holding ${permission} (or a super admin) can grant it`, () => {
      expect(actorCanGrantPermission([permission], false, permission)).toBe(true);
      expect(actorCanGrantPermission(INTERNAL_PERMISSIONS.filter((p) => p !== permission), false, permission)).toBe(
        false,
      );
      expect(actorCanGrantPermission([], true, permission)).toBe(true);
    });
  }
});

describe("previewEffectivePermissions", () => {
  it("matches getEffectivePermissions for every role slug", async () => {
    for (const slug of INTERNAL_ROLE_SLUGS) {
      const preview = previewEffectivePermissions({ roleSlug: slug, isSuperAdmin: false, overrides: [], rolePermissionMap });
      const live = await getEffectivePermissions(
        fakeClient({ userRole: { role_id: `role-${slug}`, is_active: true }, overrides: [] }),
        "u",
        { role: "admin", is_super_admin: false },
        catalog,
      );
      expect(preview).toEqual(live.permissions);
    }
  });

  it("applies overrides and returns nothing for no role", () => {
    expect(
      previewEffectivePermissions({
        roleSlug: null,
        isSuperAdmin: false,
        overrides: [{ permission: "view_events", granted: true }],
        rolePermissionMap,
      }),
    ).toEqual(["view_events"]);
    expect(previewEffectivePermissions({ roleSlug: null, isSuperAdmin: false, overrides: [], rolePermissionMap })).toEqual(
      [],
    );
  });
});

// ── Dashboard cards × role ───────────────────────────────────────────────────

describe("dashboard cards — every role slug × every card", () => {
  const permsFor: Record<string, InternalPermission[]> = {
    none: [],
    legacy_staff: LEGACY_STAFF_PERMISSIONS,
    regular_user: ROLE_GRANTS.regular_user,
    manager: ROLE_GRANTS.manager,
    admin: ROLE_GRANTS.admin,
    super_admin: [...INTERNAL_PERMISSIONS],
  };

  for (const [who, perms] of Object.entries(permsFor)) {
    for (const card of DASHBOARD_CARDS) {
      const see = card.view === null || perms.includes(card.view);
      const act = card.act === null || perms.includes(card.act);
      it(`${who}: ${card.id} is ${see ? "visible" : "hidden"}, ${act ? "actionable" : "read-only"}`, () => {
        expect(canSeeCard(card.id, perms)).toBe(see);
        expect(canActOnCard(card.id, perms)).toBe(act);
      });
    }
  }
});

describe("guards", () => {
  it("recognise only catalog slugs", () => {
    for (const p of INTERNAL_PERMISSIONS) expect(isInternalPermission(p)).toBe(true);
    for (const r of INTERNAL_ROLE_SLUGS) expect(isInternalRoleSlug(r)).toBe(true);
    for (const bad of ["", "founder", "analyst", "MANAGE_USERS", "owner"]) {
      expect(isInternalPermission(bad)).toBe(false);
      expect(isInternalRoleSlug(bad)).toBe(false);
    }
  });
});
