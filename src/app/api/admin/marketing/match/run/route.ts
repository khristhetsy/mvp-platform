import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { listCampaignFounders, listFounderMatches, removeFounderMatch, runCampaignMatching } from "@/lib/marketing/match-campaign/store";

export const dynamic = "force-dynamic";
// One pass loads the investor network once and scores every ready founder.
export const maxDuration = 300;

// POST /api/admin/marketing/match/run — match every ready founder.
export async function POST(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { campaign_id?: string } | null;
  if (!body?.campaign_id) return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
  try {
    const summary = await runCampaignMatching(body.campaign_id);
    const founders = await listCampaignFounders(body.campaign_id);
    return NextResponse.json({ summary, founders });
  } catch (err) {
    return errorJson(err);
  }
}

// GET /api/admin/marketing/match/run?founder= — one founder's matches (admin view, with names).
export async function GET(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const founder = new URL(request.url).searchParams.get("founder");
  if (!founder) return NextResponse.json({ error: "founder is required." }, { status: 400 });
  try {
    return NextResponse.json({ matches: await listFounderMatches(founder) });
  } catch (err) {
    return errorJson(err);
  }
}

// PATCH /api/admin/marketing/match/run — admin removes an investor from a founder's matches.
export async function PATCH(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { match_id?: string } | null;
  if (!body?.match_id) return NextResponse.json({ error: "match_id is required." }, { status: 400 });
  try {
    return NextResponse.json(await removeFounderMatch(body.match_id, auth.profile.id));
  } catch (err) {
    return errorJson(err, 400);
  }
}
