import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

// GET /api/marketing/contacts/[id]/activity — email event history for a contact
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const db = await marketingDb();

    const [{ data: events }, { data: contact }, { data: unsub }] = await Promise.all([
      db
        .from("marketing_events")
        .select("id,event_type,occurred_at,metadata,campaign_id,sequence_id,step_id,resend_id")
        .eq("contact_id", id)
        .order("occurred_at", { ascending: false })
        .limit(200),
      db
        .from("marketing_contacts")
        .select("id,email,first_name,last_name,company,tags,source,created_at")
        .eq("id", id)
        .maybeSingle(),
      db
        .from("marketing_unsubscribes")
        .select("email,reason,unsubscribed_at")
        .eq("email", (await db.from("marketing_contacts").select("email").eq("id", id).maybeSingle()).data?.email ?? "")
        .maybeSingle(),
    ]);

    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    // Collect unique campaign/sequence ids to look up names
    const campaignIds = [...new Set((events ?? []).map((e: { campaign_id: string | null }) => e.campaign_id).filter(Boolean))] as string[];
    const sequenceIds = [...new Set((events ?? []).map((e: { sequence_id: string | null }) => e.sequence_id).filter(Boolean))] as string[];

    const [{ data: campaigns }, { data: sequences }] = await Promise.all([
      campaignIds.length > 0
        ? db.from("marketing_campaigns").select("id,name").in("id", campaignIds)
        : Promise.resolve({ data: [] }),
      sequenceIds.length > 0
        ? db.from("marketing_sequences").select("id,name").in("id", sequenceIds)
        : Promise.resolve({ data: [] }),
    ]);

    const campaignMap = Object.fromEntries((campaigns ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const sequenceMap = Object.fromEntries((sequences ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));

    const enrichedEvents = (events ?? []).map((e: {
      id: string;
      event_type: string;
      occurred_at: string;
      metadata: Record<string, unknown>;
      campaign_id: string | null;
      sequence_id: string | null;
      step_id: string | null;
      resend_id: string | null;
    }) => ({
      ...e,
      campaign_name: e.campaign_id ? (campaignMap[e.campaign_id] ?? null) : null,
      sequence_name: e.sequence_id ? (sequenceMap[e.sequence_id] ?? null) : null,
    }));

    return NextResponse.json({
      contact,
      events: enrichedEvents,
      unsubscribed: unsub ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
