import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type EnrichedActivityEvent = {
  id: string;
  room_id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: "founder" | "investor" | "admin" | "system" | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ roomId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { roomId } = await params;
  const admin = createServiceRoleClient();

  // Verify this room belongs to the founder
  const { data: room } = await admin
    .from("deal_rooms")
    .select("id, founder_id, company_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.founder_id !== auth.profile.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Fetch activity events
  const { data: events, error } = await admin
    .from("deal_room_activity_events")
    .select("id, room_id, event_type, actor_user_id, metadata, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Collect unique actor user IDs (excluding null)
  const actorIds = [
    ...new Set((events ?? []).flatMap((e) => (e.actor_user_id ? [e.actor_user_id] : []))),
  ];

  // Fetch profiles for actor names
  const profileMap = new Map<string, { full_name: string | null; role: string | null }>();
  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { full_name: p.full_name, role: p.role });
    }
  }

  const enriched: EnrichedActivityEvent[] = (events ?? []).map((e) => {
    const profile = e.actor_user_id ? profileMap.get(e.actor_user_id) : null;
    const roleName = profile?.role ?? null;
    const actorRole =
      roleName === "FOUNDER" || roleName === "founder" ? "founder"
      : roleName === "INVESTOR" || roleName === "investor" ? "investor"
      : roleName === "ADMIN" || roleName === "admin" ? "admin"
      : e.actor_user_id ? "system"
      : null;

    return {
      id: String(e.id),
      room_id: String(e.room_id),
      event_type: String(e.event_type),
      actor_user_id: e.actor_user_id ?? null,
      actor_name: profile?.full_name ?? null,
      actor_role: actorRole,
      metadata: (e.metadata as Record<string, unknown> | null) ?? null,
      created_at: String(e.created_at),
    };
  });

  return NextResponse.json({ events: enriched });
}
