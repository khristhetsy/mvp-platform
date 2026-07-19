import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getCampaignRecipients,
  approveCampaign,
  setCampaignPaused,
  setCampaignWeeklyCap,
} from "@/lib/outreach/investor-outreach";

export const dynamic = "force-dynamic";

/**
 * Staff gate: resolves the signed-in user, reads `profiles.role`, and allows
 * only `admin` or `analyst`. Returns the user id on success (needed to
 * attribute approvals) or a JSON error Response.
 */
async function requireStaff(): Promise<
  { userId: string } | { error: Response }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "analyst")) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }

  return { userId: user.id };
}

// GET — send log (recipients) for a single campaign.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const { id } = await ctx.params;
  return NextResponse.json({ recipients: await getCampaignRecipients(id) });
}

// PATCH — approve / pause / resume / set weekly cap.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = await requireStaff();
  if ("error" in gate) return gate.error;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { action?: string; cap?: unknown }
    | null;
  const action = body?.action;

  let ok: boolean;
  switch (action) {
    case "approve":
      ok = await approveCampaign(id, gate.userId);
      break;
    case "pause":
      ok = await setCampaignPaused(id, true);
      break;
    case "resume":
      ok = await setCampaignPaused(id, false);
      break;
    case "cap": {
      const cap = Number(body?.cap);
      if (!Number.isFinite(cap)) {
        return NextResponse.json({ error: "cap must be a number between 5 and 20." }, { status: 400 });
      }
      ok = await setCampaignWeeklyCap(id, cap);
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok });
}
