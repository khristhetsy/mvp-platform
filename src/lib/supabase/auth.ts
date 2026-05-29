import { redirect } from "next/navigation";
import { normalizeUserRole } from "@/lib/api/admin";
import { createServerSupabaseClient } from "./server";
import type { Profile, UserRole } from "./types";

const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder/dashboard",
  investor: "/investor/dashboard",
  admin: "/admin/dashboard",
  analyst: "/admin/dashboard",
};

export function dashboardForRole(role: UserRole) {
  return dashboardByRole[role];
}

export async function getCurrentUserProfile() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return profile as Profile;
}

export async function requireUserProfile() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/sign-in");
  }

  return profile;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const profile = await requireUserProfile();
  const role = normalizeUserRole(profile.role);

  if (!role || !allowedRoles.includes(role)) {
    redirect(dashboardForRole(role ?? profile.role));
  }

  return { ...profile, role };
}
