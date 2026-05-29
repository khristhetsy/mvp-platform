import { NextResponse } from "next/server";
import { normalizeUserRole } from "@/lib/api/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/supabase/types";

export async function requireApiProfile(allowedRoles?: UserRole[]) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  const { data: profileRaw, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (profileError || !profileRaw) {
    return { error: NextResponse.json({ error: "Profile not found." }, { status: 403 }) };
  }

  const role = normalizeUserRole(String(profileRaw.role));
  const profile = { ...profileRaw, role: role ?? (profileRaw.role as UserRole) } as Profile;

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return { error: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }) };
  }

  return { supabase, profile };
}
