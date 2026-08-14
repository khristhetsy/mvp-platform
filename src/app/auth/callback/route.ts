import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dashboardForRole } from "@/lib/supabase/auth";
import { ensureUserOnboarding } from "@/lib/onboarding/ensure-founder-setup";
import { parseRequestedPlan } from "@/lib/subscriptions/plans";
import { profileRoleFromPublicMetadata } from "@/lib/auth/signup-role";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");
  // Only allow internal, non-protocol-relative paths — blocks open redirects.
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

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

      const role = existingProfile?.role ?? profileRoleFromPublicMetadata(user.user_metadata?.role) ?? "founder";
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

      // Capture the profile photo an OAuth provider (Google / LinkedIn) returns,
      // so the avatar shows automatically. Best-effort — never block the login.
      const providerAvatar =
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null;
      if (providerAvatar) {
        try {
          await supabase.from("profiles").update({ avatar_url: providerAvatar } as never).eq("id", user.id);
        } catch {
          /* avatar_url column may not exist yet — ignore */
        }
      }

      const redirectPath =
        next ||
        (isNewProfile && profile.role === "founder"
          ? "/founder/onboarding"
          : isNewProfile && profile.role === "investor"
            ? "/investor/onboarding"
            : dashboardForRole(profile.role));

      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  // No `code` on the query string. That's either a plain visit, or Supabase used
  // the implicit flow and put the session tokens in the URL *fragment* — which a
  // server route can't read (browsers never send the #fragment upstream). Hand off
  // to a client page that reads the hash, sets the session, and routes by role.
  // The browser preserves the #fragment across this fragment-less redirect.
  const completeUrl = new URL("/auth/callback/complete", requestUrl.origin);
  if (next) completeUrl.searchParams.set("next", next);
  return NextResponse.redirect(completeUrl);
}
