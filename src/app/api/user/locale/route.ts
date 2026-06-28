import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Persist the signed-in user's language preference (so emails reach them in it). */
export async function POST(request: Request): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { locale?: string } | null;
  const locale = body?.locale;
  if (locale !== "en" && locale !== "es") {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("profiles").update({ locale }).eq("id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, locale });
}
