import { NextResponse } from "next/server";
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

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Profile not found." }, { status: 403 }) };
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return { error: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }) };
  }

  return { supabase, profile: profile as Profile };
}
