import { NextResponse } from "next/server";
import { errorJson, guardMatchAdmin } from "@/lib/marketing/match-campaign/api-guard";
import { sendMatchTest } from "@/lib/marketing/match-campaign/send";
import { getMatchCampaign } from "@/lib/marketing/match-campaign/store";
import { sendCampaign } from "@/lib/marketing/campaigns";
import { marketingDb } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/marketing/match/send
//   action "test"     — one [TEST] copy to the admin, rendered for a founder
//   action "schedule" — schedule; the existing 15 minute campaign cron sends it
//   action "send_now" — send today's batch now through the shared send path
export async function POST(request: Request) {
  const auth = await guardMatchAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    campaign_id?: string; action?: "test" | "schedule" | "send_now"; to?: string; founder_id?: string | null; scheduled_at?: string;
  } | null;
  if (!body?.campaign_id || !body.action) return NextResponse.json({ error: "campaign_id and action are required." }, { status: 400 });
  try {
    const campaign = await getMatchCampaign(body.campaign_id);
    if (!campaign) return NextResponse.json({ error: "Match campaign not found." }, { status: 404 });

    if (body.action === "test") {
      const to = (typeof body.to === "string" && body.to.trim()) || auth.profile.email;
      if (!to) return NextResponse.json({ error: "No recipient email on your profile." }, { status: 400 });
      const result = await sendMatchTest(body.campaign_id, to, body.founder_id ?? null);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    if (body.action === "schedule") {
      const at = body.scheduled_at ? new Date(body.scheduled_at) : null;
      if (!at || Number.isNaN(at.getTime())) return NextResponse.json({ error: "A valid send date and time is required." }, { status: 400 });
      if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
        return NextResponse.json({ error: `A ${campaign.status} campaign can't be rescheduled.` }, { status: 400 });
      }
      await marketingDb()
        .from("marketing_campaigns")
        .update({ status: "scheduled", scheduled_at: at.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", body.campaign_id);
      return NextResponse.json({ ok: true });
    }

    // send_now goes through sendCampaign, which applies the same status gate and
    // MARKETING_SEND_LIVE kill switch as every campaign, then hands off to the
    // Match sender.
    return NextResponse.json(await sendCampaign(body.campaign_id));
  } catch (err) {
    return errorJson(err);
  }
}
