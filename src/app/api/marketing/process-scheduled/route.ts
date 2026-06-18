import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { sendCampaign } from "@/lib/marketing/campaigns";

// Called by cron or admin trigger — fires campaigns whose scheduled_at is in the past
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await marketingDb();
  const { data: due } = await db
    .from("marketing_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  let processed = 0;
  for (const campaign of due ?? []) {
    try {
      await sendCampaign(campaign.id);
      processed++;
    } catch {
      // continue on individual failure
    }
  }

  return NextResponse.json({ ok: true, processed });
}

// POST — admin manual trigger (no cron auth required, uses session auth)
export async function POST(): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const db = await marketingDb();
    const { data: due } = await db
      .from("marketing_campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    let processed = 0;
    for (const campaign of due ?? []) {
      try {
        await sendCampaign(campaign.id);
        processed++;
      } catch {
        // continue
      }
    }
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
