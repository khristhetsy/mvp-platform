import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listCampaigns, saveCampaign, audienceCount } from "@/lib/icfo-events/invitations/store";
import { getLiveCountsPerEvent } from "@/lib/icfo-events/invitations/live-stats";

export const dynamic = "force-dynamic";

/** Campaigns, the events they can invite to, the audience lists, and today's numbers. */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = auth.supabase as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const nowIso = new Date().toISOString();
  const [{ data: events }, { data: lists }, campaigns] = await Promise.all([
    db.from("events").select("id, slug, title, starts_at, status").gt("starts_at", nowIso).in("status", ["published", "live"]).order("starts_at", { ascending: true }),
    db.from("marketing_lists").select("id, name, archived").eq("archived", false).order("name", { ascending: true }),
    listCampaigns(),
  ]);
  const listRows = (lists ?? []) as Array<{ id: string; name: string }>;
  const counts = await Promise.all(listRows.map((l) => audienceCount(l.id).catch(() => 0)));
  const eventRows = (events ?? []) as Array<{ id: string }>;
  return NextResponse.json({
    campaigns,
    events: eventRows,
    lists: listRows.map((l, i) => ({ id: l.id, name: l.name, count: counts[i] })),
    today: await getLiveCountsPerEvent(eventRows.map((e) => e.id)),
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  try {
    const campaign = await saveCampaign(null, {
      name: String(body.name ?? ""),
      eventIds: Array.isArray(body.eventIds) ? body.eventIds.map(String) : [],
      audiences: body.audiences,
      scheduleAt: typeof body.scheduleAt === "string" ? body.scheduleAt : null,
      stats: body.stats,
      fromName: typeof body.fromName === "string" ? body.fromName : null,
      fromEmail: typeof body.fromEmail === "string" ? body.fromEmail : null,
    }, auth.userId);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 400 });
  }
}
