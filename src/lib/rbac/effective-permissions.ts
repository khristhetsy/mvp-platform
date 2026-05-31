import { profileIsSuperAdmin } from "@/lib/api/super-admin";
import {
  INTERNAL_PERMISSIONS,
  INTERNAL_ROLE_RANK,
  LEGACY_STAFF_PERMISSIONS,
  type InternalPermission,
  type InternalRoleSlug,
  isInternalPermission,
  isInternalRoleSlug,
} from "@/lib/rbac/constants";
import type {
  EffectivePermissionsResult,
  InternalPermissionRow,
  InternalRoleRow,
  InternalUserRoleRow,
} from "@/lib/rbac/types";
import type { Profile } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

type RolePermissionMap = Map<InternalRoleSlug, Set<InternalPermission>>;

function buildRolePermissionMap(
  roles: InternalRoleRow[],
  permissions: InternalPermissionRow[],
  rolePermissions: Array<{ role_id: string; permission_id: string; granted: boolean }>,
): RolePermissionMap {
  const permById = new Map(permissions.map((p) => [p.id, p.slug]));
  const roleById = new Map(roles.map((r) => [r.id, r.slug]));
  const map: RolePermissionMap = new Map();

  for (const rp of rolePermissions) {
    if (!rp.granted) continue;
    const roleSlug = roleById.get(rp.role_id);
    const permSlug = permById.get(rp.permission_id);
    if (!roleSlug || !permSlug || !isInternalRoleSlug(roleSlug) || !isInternalPermission(permSlug)) continue;
    const set = map.get(roleSlug) ?? new Set<InternalPermission>();
    set.add(permSlug);
    map.set(roleSlug, set);
  }

  return map;
}

export function isSuperAdmin(profile: { role?: string | null; is_super_admin?: boolean | null }) {
  return profileIsSuperAdmin(profile);
}

export async function loadRbacCatalog(supabase: Client) {
  const [{ data: roles }, { data: permissions }, { data: rolePermissions }] = await Promise.all([
    supabase.from("internal_roles").select("*").eq("is_active", true).order("rank"),
    supabase.from("internal_permissions").select("*").order("slug"),
    supabase.from("internal_role_permissions").select("role_id, permission_id, granted"),
  ]);

  return {
    roles: (roles ?? []) as InternalRoleRow[],
    permissions: (permissions ?? []) as InternalPermissionRow[],
    rolePermissionMap: buildRolePermissionMap(
      (roles ?? []) as InternalRoleRow[],
      (permissions ?? []) as InternalPermissionRow[],
      rolePermissions ?? [],
    ),
  };
}

export async function getEffectivePermissions(
  supabase: Client,
  userId: string,
  profile?: Pick<Profile, "role" | "is_super_admin"> | null,
  catalog?: Awaited<ReturnType<typeof loadRbacCatalog>>,
): Promise<EffectivePermissionsResult> {
  let resolvedProfile = profile;
  if (!resolvedProfile) {
    const { data } = await supabase.from("profiles").select("role, is_super_admin").eq("id", userId).maybeSingle();
    resolvedProfile = data as Pick<Profile, "role" | "is_super_admin"> | null;
  }

  if (resolvedProfile && isSuperAdmin(resolvedProfile)) {
    return {
      permissions: [...INTERNAL_PERMISSIONS],
      roleSlug: "super_admin",
      isSuperAdmin: true,
      isActive: true,
      legacyFallback: false,
    };
  }

  const { rolePermissionMap, roles, permissions: allPermissions } = catalog ?? (await loadRbacCatalog(supabase));
  const permById = new Map(allPermissions.map((p) => [p.id, p.slug]));
  const roleById = new Map(roles.map((r) => [r.id, r.slug]));

  const { data: userRoleRaw } = await supabase
    .from("internal_user_roles")
    .select("user_id, role_id, is_active, assigned_at, assigned_by")
    .eq("user_id", userId)
    .maybeSingle();

  const userRole = userRoleRaw as InternalUserRoleRow | null;

  if (!userRole || !userRole.is_active) {
    const legacyStaff =
      resolvedProfile?.role &&
      ["admin", "analyst"].includes(String(resolvedProfile.role).toLowerCase());

    if (legacyStaff) {
      return {
        permissions: [...LEGACY_STAFF_PERMISSIONS],
        roleSlug: null,
        isSuperAdmin: false,
        isActive: true,
        legacyFallback: true,
      };
    }

    return {
      permissions: [],
      roleSlug: null,
      isSuperAdmin: false,
      isActive: userRole ? userRole.is_active : false,
      legacyFallback: false,
    };
  }

  const roleSlugRaw = roleById.get(userRole.role_id);
  const roleSlug = roleSlugRaw && isInternalRoleSlug(roleSlugRaw) ? roleSlugRaw : null;

  if (roleSlug === "super_admin") {
    return {
      permissions: [...INTERNAL_PERMISSIONS],
      roleSlug: "super_admin",
      isSuperAdmin: true,
      isActive: true,
      legacyFallback: false,
    };
  }

  const base = new Set<InternalPermission>(roleSlug ? [...(rolePermissionMap.get(roleSlug) ?? [])] : []);

  const { data: overridesRaw } = await supabase
    .from("internal_user_permission_overrides")
    .select("permission_id, granted")
    .eq("user_id", userId);

  for (const row of overridesRaw ?? []) {
    const slugRaw = permById.get(row.permission_id);
    if (!slugRaw || !isInternalPermission(slugRaw)) continue;
    if (row.granted) base.add(slugRaw);
    else base.delete(slugRaw);
  }

  return {
    permissions: INTERNAL_PERMISSIONS.filter((p) => base.has(p)),
    roleSlug,
    isSuperAdmin: false,
    isActive: true,
    legacyFallback: false,
  };
}

export async function canUser(
  supabase: Client,
  userId: string,
  permission: InternalPermission,
  profile?: Pick<Profile, "role" | "is_super_admin"> | null,
) {
  const effective = await getEffectivePermissions(supabase, userId, profile);
  return effective.isActive && effective.permissions.includes(permission);
}

export function actorCanManageTargetRole(
  actorRoleSlug: InternalRoleSlug | null,
  actorIsSuperAdmin: boolean,
  targetRoleSlug: InternalRoleSlug,
) {
  if (actorIsSuperAdmin) return true;
  if (targetRoleSlug === "super_admin") return false;
  if (!actorRoleSlug) return false;

  const actorRank = INTERNAL_ROLE_RANK[actorRoleSlug];
  const targetRank = INTERNAL_ROLE_RANK[targetRoleSlug];
  return actorRank > targetRank;
}

export function actorCanGrantPermission(
  actorPermissions: InternalPermission[],
  actorIsSuperAdmin: boolean,
  permission: InternalPermission,
) {
  if (actorIsSuperAdmin) return true;
  return actorPermissions.includes(permission);
}
