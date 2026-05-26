import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dashboardForRole } from "@/lib/supabase/auth";

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
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

      if (profile?.role) {
        return NextResponse.redirect(new URL(next || dashboardForRole(profile.role), requestUrl.origin));
      }
    }
  }

  // Handle password recovery and other token types
  const hash = requestUrl.hash;
  if (hash.includes("type=recovery") || hash.includes("access_token")) {
    // Redirect to password reset page so the client can handle the token
    return NextResponse.redirect(new URL(`/auth/reset-password${requestUrl.search}${requestUrl.hash}`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next || "/", requestUrl.origin));
}
