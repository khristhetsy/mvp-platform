import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { hideInvestorFromFounders, listCampaignFounders, listFounderMatches, removeFounderMatch, runCampaignMatching } from "@/lib/marketing/match-campaign/store";

export const dynamic = "force-dynamic";
// One batch loads the investor network once and scores up to MATCH_BATCH founders.
export const maxDuration = 300;

// POST /api/admin/marketing/match/run { campaign_id, after? } — match the next batch of
// ready founders. The editor repeats with `after: next` until next is null; the
// founder rows come back with the last batch.
export async function POST(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { campaign_id?: string; after?: string | null } | null;
  if (!body?.campaign_id) return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
  try {
    const run = await runCampaignMatching(body.campaign_id, { after: typeof body.after === "string" ? body.after : null });
    const founders = run.next ? null : await listCampaignFounders(body.campaign_id);
    return NextResponse.json({ ...run, founders });
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

// PATCH /api/admin/marketing/match/run — admin removes an investor from a founder's
// matches. With hide: true the investor is also hidden from every founder (all
// future matching runs skip them).
export async function PATCH(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as { match_id?: string; hide?: boolean } | null;
  if (!body?.match_id) return NextResponse.json({ error: "match_id is required." }, { status: 400 });
  try {
    if (body.hide) await hideInvestorFromFounders(body.match_id);
    return NextResponse.json(await removeFounderMatch(body.match_id, auth.profile.id));
  } catch (err) {
    return errorJson(err, 400);
  }
}
