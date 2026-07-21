import {
  INTERNAL_PERMISSIONS,
  INTERNAL_ROLE_LABELS,
  type InternalPermission,
  type InternalRoleSlug,
  isInternalPermission,
  isInternalRoleSlug,
} from "@/lib/rbac/constants";
import {
  actorCanGrantPermission,
  actorCanManageTargetRole,
  getEffectivePermissions,
  isSuperAdmin,
  loadRbacCatalog,
} from "@/lib/rbac/effective-permissions";
import type { InternalUserSummary } from "@/lib/rbac/types";
import { writeAuditLog } from "@/lib/data/audit";
import type { Profile } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function listInternalUsers(supabase: Client): Promise<InternalUserSummary[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_super_admin")
    .in("role", ["admin", "analyst"])
    .order("email");

  const staffProfiles = (profiles ?? []) as Array<Profile & { is_super_admin?: boolean }>;
  const userIds = staffProfiles.map((p) => p.id);

  const [{ data: userRoles }, { data: overridesRaw }, catalog] = await Promise.all([
    supabase
      .from("internal_user_roles")
      .select("user_id, role_id, is_active")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("internal_user_permission_overrides")
      .select("user_id, permission_id, granted")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    loadRbacCatalog(supabase),
  ]);

  const roleById = new Map(catalog.roles.map((r) => [r.id, r]));
  const permById = new Map(catalog.permissions.map((p) => [p.id, p.slug]));

  const roleByUser = new Map(
    (userRoles ?? []).map((row) => {
      const typed = row as { user_id: string; role_id: string; is_active: boolean };
      const role = roleById.get(typed.role_id);
      return [typed.user_id, { ...typed, role }] as const;
    }),
  );

  const overridesByUser = new Map<string, Array<{ permission: InternalPermission; granted: boolean }>>();
  for (const row of overridesRaw ?? []) {
    const typed = row as { user_id: string; permission_id: string; granted: boolean };
    const slugRaw = permById.get(typed.permission_id);
    if (!slugRaw || !isInternalPermission(slugRaw)) continue;
    const list = overridesByUser.get(typed.user_id) ?? [];
    list.push({ permission: slugRaw, granted: typed.granted });
    overridesByUser.set(typed.user_id, list);
  }

  const summaries: InternalUserSummary[] = [];

  for (const profile of staffProfiles) {
    const effective = await getEffectivePermissions(supabase, profile.id, profile, catalog);
    const assignment = roleByUser.get(profile.id);
    const roleSlugRaw = assignment?.role?.slug;
    const roleSlug =
      isSuperAdmin(profile) || effective.roleSlug === "super_admin"
        ? ("super_admin" as InternalRoleSlug)
        : roleSlugRaw && isInternalRoleSlug(roleSlugRaw)
          ? roleSlugRaw
          : effective.legacyFallback
            ? ("admin" as InternalRoleSlug)
            : null;

    summaries.push({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      profileRole: profile.role,
      isSuperAdmin: isSuperAdmin(profile) || effective.isSuperAdmin,
      roleSlug,
      roleLabel: roleSlug ? INTERNAL_ROLE_LABELS[roleSlug] : null,
      isActive: assignment ? assignment.is_active : effective.isActive,
      effectivePermissions: effective.permissions,
      overrides: overridesByUser.get(profile.id) ?? [],
    });
  }

  return summaries;
}

export type UpdateInternalUserInput = {
  roleSlug?: InternalRoleSlug;
  isActive?: boolean;
  overrides?: Array<{ permission: InternalPermission; granted: boolean | null }>;
};

export async function updateInternalUserPermissions(
  supabase: Client,
  actorId: string,
  targetUserId: string,
  input: UpdateInternalUserInput,
) {
  if (actorId === targetUserId && input.roleSlug === "super_admin") {
    throw new Error("You cannot elevate yourself to super admin.");
  }

  const [{ data: actorProfile }, { data: targetProfile }] = await Promise.all([
    supabase.from("profiles").select("role, is_super_admin").eq("id", actorId).single(),
    supabase.from("profiles").select("role, is_super_admin, email, full_name").eq("id", targetUserId).single(),
  ]);

  if (!targetProfile) throw new Error("User not found.");

  const actorEffective = await getEffectivePermissions(supabase, actorId, actorProfile as Profile);
  const actorIsSuperAdmin = actorEffective.isSuperAdmin;
  const actorRoleSlug = actorEffective.roleSlug;

  const catalog = await loadRbacCatalog(supabase);
  const roleBySlug = new Map(catalog.roles.map((r) => [r.slug, r]));
  const permBySlug = new Map(catalog.permissions.map((p) => [p.slug, p]));

  if (input.roleSlug) {
    if (!isInternalRoleSlug(input.roleSlug)) throw new Error("Invalid role.");
    if (input.roleSlug === "super_admin" && !actorIsSuperAdmin) {
      throw new Error("Only super admins can assign the super admin role.");
    }
    if (!actorCanManageTargetRole(actorRoleSlug, actorIsSuperAdmin, input.roleSlug)) {
      throw new Error("You cannot assign a role at or above your level.");
    }

    const role = roleBySlug.get(input.roleSlug);
    if (!role) throw new Error("Role not found.");

    // These writes were previously unchecked, so a failed REVOKE reported
    // success — an admin would believe they had removed super-admin from someone
    // who still had it. Throw instead: the caller must not see success here.
    if (input.roleSlug === "super_admin") {
      const { error } = await supabase.from("profiles").update({ is_super_admin: true }).eq("id", targetUserId);
      if (error) throw new Error(`Failed to grant super admin: ${error.message}`);
    } else if (isSuperAdmin(targetProfile as Profile)) {
      const { error } = await supabase.from("profiles").update({ is_super_admin: false }).eq("id", targetUserId);
      if (error) throw new Error(`Failed to revoke super admin: ${error.message}`);
    }

    await supabase.from("internal_user_roles").upsert(
      {
        user_id: targetUserId,
        role_id: role.id,
        is_active: input.isActive ?? true,
        assigned_by: actorId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } else if (typeof input.isActive === "boolean") {
    const { data: existingRole } = await supabase
      .from("internal_user_roles")
      .select("role_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const targetSlugRaw = existingRole?.role_id ? catalog.roles.find((r) => r.id === existingRole.role_id)?.slug : null;
    const targetSlug = targetSlugRaw && isInternalRoleSlug(targetSlugRaw) ? targetSlugRaw : null;
    if (targetSlug && !actorCanManageTargetRole(actorRoleSlug, actorIsSuperAdmin, targetSlug)) {
      throw new Error("You cannot modify this user's access.");
    }

    const { error } = await supabase
      .from("internal_user_roles")
      .update({ is_active: input.isActive, assigned_by: actorId })
      .eq("user_id", targetUserId);

    if (error && input.isActive === false) {
      const adminRole = roleBySlug.get("regular_user");
      if (adminRole) {
        await supabase.from("internal_user_roles").upsert(
          {
            user_id: targetUserId,
            role_id: adminRole.id,
            is_active: false,
            assigned_by: actorId,
          },
          { onConflict: "user_id" },
        );
      }
    }
  }

  if (input.overrides) {
    for (const override of input.overrides) {
      if (!isInternalPermission(override.permission)) continue;

      const targetEffective = await getEffectivePermissions(supabase, targetUserId, targetProfile as Profile, catalog);
      const targetRoleSlug = input.roleSlug ?? targetEffective.roleSlug;
      if (targetRoleSlug && !actorCanManageTargetRole(actorRoleSlug, actorIsSuperAdmin, targetRoleSlug)) {
        throw new Error("You cannot modify permissions for this user.");
      }

      if (!actorCanGrantPermission(actorEffective.permissions, actorIsSuperAdmin, override.permission)) {
        throw new Error(`You cannot grant permission: ${override.permission}`);
      }

      const perm = permBySlug.get(override.permission);
      if (!perm) continue;

      if (override.granted === null) {
        await supabase
          .from("internal_user_permission_overrides")
          .delete()
          .eq("user_id", targetUserId)
          .eq("permission_id", perm.id);
      } else {
        await supabase.from("internal_user_permission_overrides").upsert(
          {
            user_id: targetUserId,
            permission_id: perm.id,
            granted: override.granted,
            created_by: actorId,
            created_at: new Date().toISOString(),
          },
          { onConflict: "user_id,permission_id" },
        );
      }
    }
  }

  const updated = await getEffectivePermissions(supabase, targetUserId, targetProfile as Profile, catalog);

  await writeAuditLog(supabase, {
    userId: actorId,
    action: "admin.internal_permissions_updated",
    entityType: "profile",
    entityId: targetUserId,
    metadata: {
      targetEmail: (targetProfile as Profile).email,
      roleSlug: input.roleSlug ?? null,
      isActive: input.isActive ?? null,
      overrides: input.overrides ?? null,
      effectivePermissions: updated.permissions,
    },
  });

  return updated;
}

export function previewEffectivePermissions(input: {
  roleSlug: InternalRoleSlug | null;
  isSuperAdmin: boolean;
  overrides: Array<{ permission: InternalPermission; granted: boolean }>;
  rolePermissionMap: Map<InternalRoleSlug, Set<InternalPermission>>;
}) {
  if (input.isSuperAdmin || input.roleSlug === "super_admin") {
    return [...INTERNAL_PERMISSIONS];
  }

  const base = new Set<InternalPermission>(
    input.roleSlug ? [...(input.rolePermissionMap.get(input.roleSlug) ?? [])] : [],
  );

  for (const override of input.overrides) {
    if (override.granted) base.add(override.permission);
    else base.delete(override.permission);
  }

  return INTERNAL_PERMISSIONS.filter((p) => base.has(p));
}
