import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureUserOnboarding } from "@/lib/onboarding/ensure-founder-setup";
import type { UserRole } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const role = (body.role as UserRole | undefined) ?? "founder";

    const { profile, company } = await ensureUserOnboarding({
      userId: user.id,
      email: user.email ?? null,
      fullName: (body.fullName as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? null,
      role,
    });

    return NextResponse.json({ profile, company }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
