import { NextResponse } from "next/server";
import { STAFF_ROLES, normalizeUserRole } from "@/lib/api/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import type { Profile } from "@/lib/supabase/types";

export async function GET() {
  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profileRaw } = await userSupabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRaw as (Profile & { is_super_admin?: boolean }) | null;

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  const role = normalizeUserRole(profile.role);
  if (!role || !STAFF_ROLES.includes(role)) {
    if (!profile.is_super_admin) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }
  }

  const supabase = createServiceRoleClient();
  const effective = await getEffectivePermissions(supabase, user.id, profile);

  return NextResponse.json({
    permissions: effective.permissions,
    isSuperAdmin: effective.isSuperAdmin,
    roleSlug: effective.roleSlug,
  });
}
