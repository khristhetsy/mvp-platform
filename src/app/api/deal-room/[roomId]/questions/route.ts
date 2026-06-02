import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeDealRoomActivity } from "@/lib/deal-rooms/activity";
import { createNotification } from "@/lib/notifications/notifications";

const createSchema = z.object({
  category: z.enum(["financial", "legal", "traction", "market", "product", "team", "compliance", "operations", "other"]),
  question: z.string().min(1).max(6000),
});

const respondSchema = z.object({
  response: z.string().min(1).max(6000),
  status: z.enum(["open", "resolved", "clarification_requested"]).optional(),
});

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ roomId: string }> }>,
) {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error;
  const { roomId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: row, error } = await auth.supabase
    .from("deal_room_questions")
    .insert({
      room_id: roomId,
      asked_by_user_id: auth.profile.id,
      category: parsed.data.category,
      question: parsed.data.question,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const admin = createServiceRoleClient();
  await writeDealRoomActivity(admin, {
    roomId,
    eventType: "question_created",
    actorUserId: auth.profile.id,
    metadata: { category: parsed.data.category },
  });

  const { data: room } = await admin.from("deal_rooms").select("founder_id, title, company_id").eq("id", roomId).maybeSingle();
  if (room?.founder_id) {
    await createNotification({
      recipientUserId: room.founder_id,
      actorUserId: auth.profile.id,
      type: "deal_room_question_created",
      title: "New investor question",
      message: `New due diligence question in deal room: ${room.title}`,
      entityType: "deal_room",
      entityId: roomId,
      deepLink: `/founder/deal-room/${roomId}`,
      dedupeKey: `deal_room_question:${roomId}:${row.id}`,
    });
  }

  return NextResponse.json({ question: row });
}

export async function PATCH(
  request: Request,
  { params }: Readonly<{ params: Promise<{ roomId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { roomId } = await params;

  const body = await request.json().catch(() => ({}));
  const questionId = typeof body.questionId === "string" ? body.questionId : null;
  if (!questionId) return NextResponse.json({ error: "questionId is required." }, { status: 400 });

  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const patch = {
    founder_response: parsed.data.response,
    responded_at: new Date().toISOString(),
    status: parsed.data.status ?? "open",
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await auth.supabase
    .from("deal_room_questions")
    .update(patch)
    .eq("id", questionId)
    .eq("room_id", roomId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const admin = createServiceRoleClient();
  await writeDealRoomActivity(admin, {
    roomId,
    eventType: "founder_responded",
    actorUserId: auth.profile.id,
    metadata: { question_id: questionId, status: patch.status },
  });

  const { data: room } = await admin.from("deal_rooms").select("investor_user_id, title").eq("id", roomId).maybeSingle();
  if (room?.investor_user_id) {
    await createNotification({
      recipientUserId: room.investor_user_id,
      actorUserId: auth.profile.id,
      type: "deal_room_founder_responded",
      title: "Founder responded",
      message: `Founder responded in deal room: ${room.title}`,
      entityType: "deal_room",
      entityId: roomId,
      deepLink: `/investor/deal-room/${roomId}`,
      dedupeKey: `deal_room_response:${roomId}:${questionId}`,
    });
  }

  return NextResponse.json({ question: updated });
}

