import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { matchSequenceEnabled } from "@/lib/marketing/match-campaign/flag";
import { loadSequenceResults, markReplied } from "@/lib/marketing/match-campaign/followups";

export const dynamic = "force-dynamic";

function disabled() {
  return NextResponse.json({ error: "Match follow ups are not enabled." }, { status: 404 });
}

// GET /api/admin/marketing/match/sequence?campaign_id= — split test results and follow up status.
export async function GET(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  if (!matchSequenceEnabled()) return disabled();
  const id = new URL(request.url).searchParams.get("campaign_id");
  if (!id) return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
  try {
    return NextResponse.json(await loadSequenceResults(id));
  } catch (err) {
    return errorJson(err);
  }
}

// POST /api/admin/marketing/match/sequence { campaign_founder_id, replied } — mark a founder as replied (stops follow ups).
export async function POST(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  if (!matchSequenceEnabled()) return disabled();
  const body = (await request.json().catch(() => null)) as { campaign_founder_id?: unknown; replied?: unknown } | null;
  if (typeof body?.campaign_founder_id !== "string") return NextResponse.json({ error: "campaign_founder_id is required." }, { status: 400 });
  try {
    await markReplied(body.campaign_founder_id, body.replied !== false);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err);
  }
}
