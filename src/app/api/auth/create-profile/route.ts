import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { recordOperationalError } from "@/lib/monitoring/operational-events";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureUserOnboarding } from "@/lib/onboarding/ensure-founder-setup";
import { parseRequestedPlan } from "@/lib/subscriptions/plans";
import { sanitizePublicSignupRole } from "@/lib/auth/signup-role";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit({
    bucket: "auth_create_profile",
    subjectId: user.id,
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const role = sanitizePublicSignupRole(body.role);
    const requestedPlan =
      parseRequestedPlan(body.requestedPlan) ??
      parseRequestedPlan(user.user_metadata?.requested_plan);

    const { profile, company } = await ensureUserOnboarding({
      userId: user.id,
      email: user.email ?? null,
      fullName: (body.fullName as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? null,
      role,
      requestedPlan,
    });

    return NextResponse.json({ profile, company }, { status: 201 });
  } catch (error) {
    recordOperationalError("auth.create_profile_failed", error, { userId: user.id });
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
