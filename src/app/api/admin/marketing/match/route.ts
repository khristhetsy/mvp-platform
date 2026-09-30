import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import {
  createMatchCampaign,
  founderFilterOptions,
  getMatchCampaign,
  listCampaignFounders,
  updateMatchCampaign,
} from "@/lib/marketing/match-campaign/store";
import type { MatchConfig } from "@/lib/marketing/match-campaign/types";

export const dynamic = "force-dynamic";

// GET /api/admin/marketing/match?id= — campaign, its founders and the filter menus.
export async function GET(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  try {
    const [campaign, founders, options] = await Promise.all([getMatchCampaign(id), listCampaignFounders(id), founderFilterOptions()]);
    if (!campaign) return NextResponse.json({ error: "Match campaign not found." }, { status: 404 });
    return NextResponse.json({ campaign, founders, options });
  } catch (err) {
    return errorJson(err);
  }
}

// POST /api/admin/marketing/match — create a Match campaign (step 1).
export async function POST(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    name?: string; from_name?: string; from_email?: string; reply_to?: string | null; call_url?: string | null;
  } | null;
  if (!body?.name?.trim() || !body.from_name?.trim() || !body.from_email?.trim()) {
    return NextResponse.json({ error: "Campaign name, from name and from email are required." }, { status: 400 });
  }
  try {
    const campaign = await createMatchCampaign(
      { name: body.name, from_name: body.from_name, from_email: body.from_email, reply_to: body.reply_to ?? null, call_url: body.call_url ?? null },
      auth.profile.id,
    );
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    return errorJson(err);
  }
}

// PATCH /api/admin/marketing/match — edit name, sender, subject or settings.
export async function PATCH(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    id?: string; name?: string; from_name?: string; from_email?: string; reply_to?: string | null; subject_override?: string; config?: Partial<MatchConfig>;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  try {
    await updateMatchCampaign(body.id, body);
    return NextResponse.json({ ok: true, campaign: await getMatchCampaign(body.id) });
  } catch (err) {
    return errorJson(err);
  }
}
