import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

// GET /api/marketing/campaigns/[id] — campaign detail + recent events
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const db = await marketingDb();

    const [{ data: campaign }, { data: events }] = await Promise.all([
      db
        .from("marketing_campaigns")
        .select("*, marketing_lists(name), marketing_templates(name,subject)")
        .eq("id", id)
        .maybeSingle(),
      db
        .from("marketing_events")
        .select("id,event_type,occurred_at,email,metadata")
        .eq("campaign_id", id)
        .order("occurred_at", { ascending: false })
        .limit(500),
    ]);

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Event type breakdown
    const breakdown: Record<string, number> = {};
    for (const e of events ?? []) {
      breakdown[e.event_type] = (breakdown[e.event_type] ?? 0) + 1;
    }

    return NextResponse.json({ campaign, events: events ?? [], breakdown });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/marketing/campaigns/[id] — update scheduled_at, status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();
    const db = await marketingDb();
    const allowed = ["name", "status", "scheduled_at", "from_name", "from_email", "reply_to", "list_id", "template_id"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    const { data, error } = await db
      .from("marketing_campaigns")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
