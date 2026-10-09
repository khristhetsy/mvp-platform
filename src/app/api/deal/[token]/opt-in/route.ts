import { NextResponse } from "next/server";
import { optInToDealNotice } from "@/lib/listing/deal-notices";
import { dealOptInRedirect } from "@/lib/listing/private-market";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/deal/[token]/opt-in: the investor clicked "View the full deal,
 * free" on a deal notice. Records the opt in (once) and returns where to go:
 * the company card for a signed in investor, otherwise free investor sign up.
 * Public route; the notice token is the credential.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 64) {
    return NextResponse.json({ error: "This deal link is not valid." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { mode?: string } | null;
  const mode = body?.mode === "signin" ? "signin" : "signup";

  let opted: Awaited<ReturnType<typeof optInToDealNotice>>;
  try {
    opted = await optInToDealNotice(token);
  } catch (err) {
    console.error("[deal opt-in] failed", err);
    return NextResponse.json({ error: "Could not open this deal right now. Please try again." }, { status: 500 });
  }
  if (!opted) {
    return NextResponse.json({ error: "This deal link is not valid." }, { status: 404 });
  }

  let signedInRole: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      signedInRole = profile?.role ? String(profile.role).toLowerCase() : null;
    }
  } catch {
    signedInRole = null;
  }

  return NextResponse.json({
    url: dealOptInRedirect({ companyId: opted.companyId, email: opted.email, signedInRole, mode }),
  });
}
