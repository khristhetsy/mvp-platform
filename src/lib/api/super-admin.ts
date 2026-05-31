import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export function profileIsSuperAdmin(profile: { role?: string | null; is_super_admin?: boolean | null }) {
  return Boolean(profile.is_super_admin) || profile.role?.toLowerCase() === "super_admin";
}

export async function requireSuperAdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?next=/admin/page-builder-lab");
  }

  const { data: profileRaw } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileRaw as Profile & { is_super_admin?: boolean };

  if (!profile || !profileIsSuperAdmin(profile)) {
    redirect("/admin/dashboard");
  }

  return { profile, supabase, userId: user.id };
}

export async function requireSuperAdminApi() {
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

  const profile = profileRaw as (Profile & { is_super_admin?: boolean }) | null;

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Profile not found." }, { status: 403 }) };
  }

  if (!profileIsSuperAdmin(profile)) {
    return { error: NextResponse.json({ error: "Super admin access required." }, { status: 403 }) };
  }

  return {
    profile,
    userSupabase,
    supabase: createServiceRoleClient(),
    userId: user.id,
  };
}
