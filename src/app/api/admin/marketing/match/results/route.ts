import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { loadMatchResults } from "@/lib/marketing/match-campaign/results";

export const dynamic = "force-dynamic";

// GET /api/admin/marketing/match/results?campaign_id= — funnel, ROI and intros to approve.
export async function GET(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("campaign_id");
  if (!id) return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
  try {
    return NextResponse.json(await loadMatchResults(id));
  } catch (err) {
    return errorJson(err);
  }
}
