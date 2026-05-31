import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { STAFF_ROLES, normalizeUserRole, requireStaffApi } from "@/lib/api/admin";
import { profileIsSuperAdmin } from "@/lib/api/super-admin";
import type { InternalPermission } from "@/lib/rbac/constants";
import { canUser, getEffectivePermissions, isSuperAdmin } from "@/lib/rbac/effective-permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export async function requirePermissionApi(permission: InternalPermission) {
  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  const { data: profileRaw, error: profileError } = await userSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) {
    return { error: NextResponse.json({ error: "Profile not found." }, { status: 403 }) };
  }

  const profile = profileRaw as Profile & { is_super_admin?: boolean };
  const role = normalizeUserRole(profile.role);
  const staffRole = role && STAFF_ROLES.includes(role);

  if (!staffRole && !isSuperAdmin(profile)) {
    return { error: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }) };
  }

  const supabase = createServiceRoleClient();
  const allowed = await canUser(supabase, user.id, permission, profile);

  if (!allowed) {
    return { error: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }) };
  }

  const effective = await getEffectivePermissions(supabase, user.id, profile);

  return {
    profile,
    userSupabase,
    supabase,
    userId: user.id,
    effective,
  };
}

export async function requirePermissionPage(
  permission: InternalPermission,
  options?: { fallbackRoles?: typeof STAFF_ROLES; redirectTo?: string },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profileRaw } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRaw as (Profile & { is_super_admin?: boolean }) | null;

  if (!profile) {
    redirect("/auth/sign-in");
  }

  const serviceSupabase = createServiceRoleClient();
  const allowed = await canUser(serviceSupabase, user.id, permission, profile);

  if (!allowed) {
    const role = normalizeUserRole(profile.role);
    const fallbackRoles = options?.fallbackRoles ?? STAFF_ROLES;
    if (role && fallbackRoles.includes(role) && permission === "view_admin_dashboard") {
      return { profile, supabase, userId: user.id, effective: await getEffectivePermissions(serviceSupabase, user.id, profile) };
    }
    redirect(options?.redirectTo ?? "/admin/dashboard");
  }

  const effective = await getEffectivePermissions(serviceSupabase, user.id, profile);
  return { profile, supabase, userId: user.id, effective };
}

/** Page builder: manage_page_builder OR legacy super admin flag. */
export async function requirePageBuilderPage() {
  return requirePermissionPage("manage_page_builder");
}

export async function requirePageBuilderApi() {
  return requirePermissionApi("manage_page_builder");
}

/** User permissions admin: manage_users OR super admin. */
export async function requireManageUsersPage() {
  return requirePermissionPage("manage_users");
}

export async function requireManageUsersApi() {
  return requirePermissionApi("manage_users");
}

export async function getAdminNavPermissions(userId: string, profile: Profile & { is_super_admin?: boolean }) {
  const supabase = createServiceRoleClient();
  const effective = await getEffectivePermissions(supabase, userId, profile);
  return {
    permissions: effective.permissions,
    isSuperAdmin: profileIsSuperAdmin(profile) || effective.isSuperAdmin,
  };
}

export { isSuperAdmin, canUser, getEffectivePermissions };
