import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createCampaign, sendCampaign, sendCampaignTest, updateCampaignStatus } from "@/lib/marketing/campaigns";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const body = await req.json();
    const { action, campaign_id, ...rest } = body;

    if (action === "send" && campaign_id) {
      const result = await sendCampaign(campaign_id);
      return NextResponse.json(result);
    }

    // Send a single test copy to the admin's own address (or an explicit `to`).
    if (action === "test" && campaign_id) {
      const to = (typeof rest.to === "string" && rest.to.trim()) || profile.email;
      if (!to) return NextResponse.json({ error: "No recipient email available on your profile." }, { status: 400 });
      const result = await sendCampaignTest(campaign_id, to);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    if (action === "pause" && campaign_id) {
      await updateCampaignStatus(campaign_id, "paused");
      return NextResponse.json({ ok: true });
    }

    if (action === "cancel" && campaign_id) {
      await updateCampaignStatus(campaign_id, "cancelled");
      return NextResponse.json({ ok: true });
    }

    // Schedule an existing campaign
    if (action === "schedule" && campaign_id) {
      const { scheduled_at } = rest;
      if (!scheduled_at) return NextResponse.json({ error: "scheduled_at required" }, { status: 400 });
      const { createServiceRoleClient } = await import("@/lib/supabase/admin");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createServiceRoleClient() as any;
      await admin
        .from("marketing_campaigns")
        .update({ status: "scheduled", scheduled_at, updated_at: new Date().toISOString() })
        .eq("id", campaign_id);
      return NextResponse.json({ ok: true });
    }

    // Create campaign (optionally pre-scheduled)
    const campaign = await createCampaign(rest, profile.id);
    // If scheduled_at provided at creation, set status to scheduled
    if (rest.scheduled_at) {
      const { createServiceRoleClient } = await import("@/lib/supabase/admin");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createServiceRoleClient() as any;
      await admin
        .from("marketing_campaigns")
        .update({ status: "scheduled" })
        .eq("id", campaign.id);
    }
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
