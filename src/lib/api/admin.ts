import { NextResponse } from "next/server";
import { adminDebug } from "@/lib/debug/admin-debug";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/supabase/types";

export const STAFF_ROLES: UserRole[] = ["admin", "analyst"];

export function normalizeUserRole(role: string | null | undefined): UserRole | null {
  const lower = role?.toLowerCase();
  if (lower === "founder" || lower === "investor" || lower === "admin" || lower === "analyst") {
    return lower;
  }
  return null;
}

export async function requireStaffApi(allowedRoles: UserRole[] = STAFF_ROLES) {
  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await userSupabase.auth.getUser();

  if (userError || !user) {
    adminDebug({
      scope: "requireStaffApi",
      action: "auth_failed",
      error: userError ?? { message: "No user session." },
    });
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  const { data: profileRaw, error: profileError } = await userSupabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, is_super_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) {
    adminDebug({
      scope: "requireStaffApi",
      action: "profile_failed",
      userId: user.id,
      error: profileError ?? { message: "Profile missing." },
    });
    return { error: NextResponse.json({ error: "Profile not found." }, { status: 403 }) };
  }

  const role = normalizeUserRole(String(profileRaw.role));
  const profile = { ...profileRaw, role: role ?? (profileRaw.role as UserRole) } as Profile;

  if (!role || !allowedRoles.includes(role)) {
    adminDebug({
      scope: "requireStaffApi",
      action: "forbidden",
      userId: user.id,
      userRole: String(profileRaw.role),
      error: { message: "Insufficient permissions." },
    });
    return { error: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }) };
  }

  adminDebug({
    scope: "requireStaffApi",
    action: "authorized",
    userId: profile.id,
    userRole: role,
    usingServiceRole: true,
  });

  return {
    profile,
    supabase: createServiceRoleClient(),
    userSupabase,
  };
}
