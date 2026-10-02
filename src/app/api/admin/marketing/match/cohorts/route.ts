import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { matchSequenceEnabled } from "@/lib/marketing/match-campaign/flag";
import { cohortSummary } from "@/lib/marketing/match-campaign/followups";

export const dynamic = "force-dynamic";

// GET /api/admin/marketing/match/cohorts?campaign_id= — cohorts and the holdout split as they will be assigned. Read only.
export async function GET(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  if (!matchSequenceEnabled()) return NextResponse.json({ error: "Match follow ups are not enabled." }, { status: 404 });
  const id = new URL(request.url).searchParams.get("campaign_id");
  if (!id) return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
  try {
    return NextResponse.json(await cohortSummary(id));
  } catch (err) {
    return errorJson(err);
  }
}
