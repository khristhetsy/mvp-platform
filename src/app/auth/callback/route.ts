import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dashboardForRole } from "@/lib/supabase/auth";
import { ensureUserOnboarding } from "@/lib/onboarding/ensure-founder-setup";
import { parseRequestedPlan } from "@/lib/subscriptions/plans";
import type { UserRole } from "@/lib/supabase/types";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const role = existingProfile?.role ?? profileRoleFromMetadata(user.user_metadata?.role) ?? "founder";
      const fullName =
        existingProfile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null;

      const isNewProfile = !existingProfile;

      const { profile } = await ensureUserOnboarding({
        userId: user.id,
        email: user.email ?? null,
        fullName,
        role,
        requestedPlan: parseRequestedPlan(user.user_metadata?.requested_plan),
      });

      const redirectPath =
        next ||
        (isNewProfile && profile.role === "founder"
          ? "/founder/onboarding"
          : dashboardForRole(profile.role));

      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  const hash = requestUrl.hash;
  if (hash.includes("type=recovery") || hash.includes("access_token")) {
    return NextResponse.redirect(new URL(`/auth/reset-password${requestUrl.search}${requestUrl.hash}`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next || "/", requestUrl.origin));
}

function profileRoleFromMetadata(value: unknown): UserRole | null {
  if (value === "founder" || value === "investor" || value === "admin" || value === "analyst") {
    return value;
  }

  return null;
}
