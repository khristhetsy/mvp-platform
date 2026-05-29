import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dashboardForRole } from "@/lib/supabase/auth";
import { ensureUserOnboarding } from "@/lib/onboarding/ensure-founder-setup";
import type { UserRole } from "@/lib/supabase/types";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: existingProfile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();

  const role = existingProfile?.role ?? profileRoleFromMetadata(user.user_metadata?.role) ?? "founder";
  const fullName =
    existingProfile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null;

  try {
    const { profile, company } = await ensureUserOnboarding({
      userId: user.id,
      email: user.email ?? null,
      fullName,
      role,
    });

    return NextResponse.json({
      profile,
      company,
      redirectTo: dashboardForRole(profile.role),
      onboardingComplete: profile.role !== "founder" || Boolean(company),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onboarding failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function profileRoleFromMetadata(value: unknown): UserRole | null {
  if (value === "founder" || value === "investor" || value === "admin" || value === "analyst") {
    return value;
  }

  return null;
}
