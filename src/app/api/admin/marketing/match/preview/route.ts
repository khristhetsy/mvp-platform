import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { previewFounderEmail } from "@/lib/marketing/match-campaign/send";
import { makeFounderToken } from "@/lib/marketing/match-campaign/token";

export const dynamic = "force-dynamic";

// GET /api/admin/marketing/match/preview?campaign_id=&founder_id= — the email as
// that founder will get it, plus the path of their match page.
export async function GET(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const p = new URL(request.url).searchParams;
  const campaignId = p.get("campaign_id");
  const founderId = p.get("founder_id");
  if (!campaignId || !founderId) return NextResponse.json({ error: "campaign_id and founder_id are required." }, { status: 400 });
  try {
    const preview = await previewFounderEmail(campaignId, founderId);
    if (!preview) return NextResponse.json({ error: "Founder not found on this campaign." }, { status: 404 });
    // preview=1 keeps an admin look from counting as the founder opening the page.
    return NextResponse.json({ ...preview, matchPagePath: `/matches/${makeFounderToken(founderId)}?preview=1` });
  } catch (err) {
    return errorJson(err);
  }
}
