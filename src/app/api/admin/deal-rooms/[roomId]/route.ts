import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeDealRoomActivity } from "@/lib/deal-rooms/activity";
import { computeEngagementSnapshot } from "@/lib/deal-rooms/metrics";
import type { Database } from "@/lib/supabase/types";

const patchSchema = z.object({
  status: z.enum(["active", "pending", "archived", "closed"]).optional(),
  title: z.string().min(3).max(200).optional(),
});

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ roomId: string }> }>) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { roomId } = await params;
  const admin = createServiceRoleClient();

  const [{ data: room, error: roomError }, { data: questions }, { data: docRequests }, { data: activity }] =
    await Promise.all([
      admin
        .from("deal_rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle(),
      admin
        .from("deal_room_questions")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("deal_room_document_requests")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("deal_room_activity_events")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  if (roomError) return NextResponse.json({ error: apiErrorMessage(roomError) }, { status: 400 });
  if (!room) return NextResponse.json({ error: "Deal room not found." }, { status: 404 });

  type QuestionRow = Database["public"]["Tables"]["deal_room_questions"]["Row"];
  type DocRequestRow = Database["public"]["Tables"]["deal_room_document_requests"]["Row"];
  type ActivityRow = Database["public"]["Tables"]["deal_room_activity_events"]["Row"];

  const engagement = computeEngagementSnapshot({
    questions: (questions ?? []) as QuestionRow[],
    docRequests: (docRequests ?? []) as DocRequestRow[],
    activity: (activity ?? []) as ActivityRow[],
  });

  return NextResponse.json({
    room,
    questions: questions ?? [],
    docRequests: docRequests ?? [],
    activity: activity ?? [],
    engagement,
  });
}

export async function PATCH(request: Request, { params }: Readonly<{ params: Promise<{ roomId: string }> }>) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createServiceRoleClient();
  const { data: existing } = await admin.from("deal_rooms").select("status, title").eq("id", roomId).maybeSingle();
  const { data, error } = await admin
    .from("deal_rooms")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: apiErrorMessage(error) }, { status: 400 });

  if (parsed.data.status && existing?.status !== parsed.data.status) {
    await writeDealRoomActivity(admin, {
      roomId,
      eventType: "room_status_changed",
      actorUserId: auth.profile.id,
      metadata: { from: existing?.status ?? null, to: parsed.data.status },
    });
  }

  return NextResponse.json({ room: data });
}

