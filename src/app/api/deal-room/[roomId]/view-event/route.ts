import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeDealRoomActivity } from "@/lib/deal-rooms/activity";
import { createNotification } from "@/lib/notifications/notifications";
import { emailFounderRoomViewed } from "@/lib/email/deal-room-emails";

/**
 * POST /api/deal-room/[roomId]/view-event
 *
 * Records that the authenticated investor opened the deal room for the first
 * time. Writes activity, sends an in-app notification, and fires the room-
 * viewed email to the founder — all as a single server-side action rather
 * than fire-and-forget inside a Server Component page render.
 *
 * Idempotent: if a room_viewed event already exists for this investor+room
 * the route returns 204 without writing duplicates.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const profile = await requireRole(["investor"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const admin = createServiceRoleClient();

  // Idempotency check
  const { data: existing } = await admin
    .from("deal_room_activity_events")
    .select("id")
    .eq("room_id", roomId)
    .eq("event_type", "room_viewed")
    .eq("actor_user_id", profile.id)
    .limit(1)
    .maybeSingle();

  if (existing) return new Response(null, { status: 204 });

  // Write activity
  await writeDealRoomActivity(admin, {
    roomId,
    eventType: "room_viewed",
    actorUserId: profile.id,
    metadata: {},
  });

  // Notify + email founder
  const { data: room } = await admin
    .from("deal_rooms")
    .select("founder_id, title")
    .eq("id", roomId)
    .maybeSingle();

  if (room?.founder_id) {
    await createNotification({
      recipientUserId: room.founder_id,
      actorUserId: profile.id,
      type: "deal_room_viewed",
      title: "Investor viewed your deal room",
      message: `An investor opened your deal room "${room.title ?? "Deal Room"}"`,
      entityType: "deal_room",
      entityId: roomId,
      deepLink: `/founder/deal-room/${roomId}`,
      dedupeKey: `room_viewed:${roomId}:${profile.id}`,
    });

    void emailFounderRoomViewed({
      founderId: room.founder_id,
      investorId: profile.id,
      roomId,
      roomTitle: room.title ?? "Deal Room",
    });
  }

  return NextResponse.json({ recorded: true });
}
