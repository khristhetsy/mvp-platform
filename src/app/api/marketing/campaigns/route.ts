import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createCampaign, sendCampaign, updateCampaignStatus } from "@/lib/marketing/campaigns";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    const { action, campaign_id, ...rest } = body;

    if (action === "send" && campaign_id) {
      const result = await sendCampaign(campaign_id);
      return NextResponse.json(result);
    }

    if (action === "pause" && campaign_id) {
      await updateCampaignStatus(campaign_id, "paused");
      return NextResponse.json({ ok: true });
    }

    if (action === "cancel" && campaign_id) {
      await updateCampaignStatus(campaign_id, "cancelled");
      return NextResponse.json({ ok: true });
    }

    // Create campaign
    const campaign = await createCampaign(rest);
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
