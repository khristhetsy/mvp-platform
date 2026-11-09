import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dashboardForRole } from "@/lib/supabase/auth";
import { ensureUserOnboarding } from "@/lib/onboarding/ensure-founder-setup";
import { alertStaffNewCustomer, isFreshSignup } from "@/lib/notifications/new-customer-alerts";
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

      const { profile, company } = await ensureUserOnboarding({
        userId: user.id,
        email: user.email ?? null,
        fullName,
        role,
        requestedPlan: parseRequestedPlan(user.user_metadata?.requested_plan),
      });

      // Staff alert for a new founder who signed up through Google, LinkedIn or a
      // magic link. A database trigger creates the profile row before this runs,
      // so freshness decides, not "no profile yet". Deduped per company, so a
      // repeat login inside the window does not alert twice. Never throws.
      if (profile.role === "founder" && (isNewProfile || isFreshSignup((profile as { created_at?: string | null }).created_at))) {
        const requestedPlan = parseRequestedPlan(user.user_metadata?.requested_plan);
        await alertStaffNewCustomer({
          event: "signup",
          founderId: user.id,
          founderEmail: user.email ?? null,
          founderName: fullName,
          companyId: (company as { id?: string } | null)?.id ?? null,
          companyName: (company as { company_name?: string | null } | null)?.company_name ?? null,
          plan: requestedPlan,
          paymentPending: Boolean(requestedPlan && requestedPlan !== "founder_free" && requestedPlan !== "founder_trial"),
        });
      }

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
            : profile.role === "admin" || profile.role === "analyst"
              ? "/admin/start" // Home grid or Dashboard, as set company-wide
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
