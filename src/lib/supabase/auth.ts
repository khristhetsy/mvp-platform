import { redirect } from "next/navigation";
import { normalizeUserRole } from "@/lib/api/admin";
import { createServerSupabaseClient } from "./server";
import type { Profile, UserRole } from "./types";

const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder",
  investor: "/investor/dashboard",
  admin: "/admin",
  analyst: "/admin",
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

/** Canonical investor filter: auth user id (same value written to investor_id by API routes). */
export async function resolveInvestorIdFromSession(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  return user.id;
}

export async function requireInvestorWorkspaceSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/sign-in");
  }

  const { data: profileRaw, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) {
    redirect("/auth/sign-in");
  }

  const role = normalizeUserRole(profileRaw.role);
  const profile = { ...(profileRaw as Profile), role: role ?? (profileRaw.role as UserRole) };

  if (!role || role !== "investor") {
    redirect(dashboardForRole(role ?? profile.role));
  }

  return {
    supabase,
    profile,
    investorId: user.id,
  };
}
