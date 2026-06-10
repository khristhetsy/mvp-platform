import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export async function PATCH(request: Request) {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    const supabase = await createServerSupabaseClient();
    const body = (await request.json()) as { full_name?: string };

    if (!body.full_name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: body.full_name.trim() })
      .eq("id", profile.id);

    if (error) {
      return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["admin", "analyst"]);
    const supabase = await createServerSupabaseClient();
    const body = (await request.json()) as { action?: string; password?: string; email?: string };

    if (body.action === "change_password") {
      if (!body.password || body.password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }
      const { error } = await supabase.auth.updateUser({ password: body.password });
      if (error) {
        return NextResponse.json({ error: error.message ?? "Could not update password." }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "reset_password") {
      if (!body.email) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 });
      }
      const origin = new URL(request.url).origin;
      const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
        redirectTo: `${origin}/auth/callback?next=/admin/profile`,
      });
      if (error) {
        return NextResponse.json({ error: error.message ?? "Could not send reset email." }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}
