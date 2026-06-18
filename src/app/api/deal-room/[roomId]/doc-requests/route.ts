import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeDealRoomActivity } from "@/lib/deal-rooms/activity";
import { createNotification } from "@/lib/notifications/notifications";
import { emailFounderDocumentRequested } from "@/lib/email/deal-room-emails";

const createSchema = z.object({
  request_type: z.enum(["financials", "cap_table", "legal_docs", "customer_metrics", "custom"]),
  custom_request: z.string().max(2000).optional().nullable(),
});

const fulfillSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["fulfilled", "clarification_requested"]).default("fulfilled"),
  founder_note: z.string().max(4000).optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
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
    .from("deal_room_document_requests")
    .insert({
      room_id: roomId,
      requested_by_user_id: auth.profile.id,
      request_type: parsed.data.request_type,
      custom_request: parsed.data.request_type === "custom" ? (parsed.data.custom_request ?? "") : null,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const admin = createServiceRoleClient();
  await writeDealRoomActivity(admin, {
    roomId,
    eventType: "doc_requested",
    actorUserId: auth.profile.id,
    metadata: { request_type: parsed.data.request_type },
  });

  const { data: room } = await admin.from("deal_rooms").select("founder_id, title").eq("id", roomId).maybeSingle();
  if (room?.founder_id) {
    await createNotification({
      recipientUserId: room.founder_id,
      actorUserId: auth.profile.id,
      type: "deal_room_doc_requested",
      title: "New document request",
      message: `New document request in deal room: ${room.title}`,
      entityType: "deal_room",
      entityId: roomId,
      deepLink: `/founder/deal-room/${roomId}`,
      dedupeKey: `deal_room_doc_request:${roomId}:${row.id}`,
    });
    // Fire-and-forget email — does not block response
    const DOC_LABELS: Record<string, string> = {
      financials: "Financial Statements",
      cap_table: "Cap Table",
      legal_docs: "Legal Documents",
      customer_metrics: "Customer Metrics",
      custom: parsed.data.custom_request || "Custom Document",
    };
    void emailFounderDocumentRequested({
      founderId: room.founder_id,
      investorId: auth.profile.id,
      roomId,
      roomTitle: room.title ?? "Deal Room",
      documentLabel: DOC_LABELS[parsed.data.request_type] ?? parsed.data.request_type,
    });
  }

  return NextResponse.json({ request: row });
}

export async function PATCH(
  request: Request,
  { params }: Readonly<{ params: Promise<{ roomId: string }> }>,
) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { roomId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = fulfillSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const patch = {
    status: parsed.data.status,
    founder_note: parsed.data.founder_note ?? null,
    fulfilled_document_id: parsed.data.document_id ?? null,
    fulfilled_at: parsed.data.status === "fulfilled" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await auth.supabase
    .from("deal_room_document_requests")
    .update(patch)
    .eq("id", parsed.data.requestId)
    .eq("room_id", roomId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const admin = createServiceRoleClient();
  await writeDealRoomActivity(admin, {
    roomId,
    eventType: patch.status === "fulfilled" ? "doc_fulfilled" : "follow_up_requested",
    actorUserId: auth.profile.id,
    metadata: { request_id: parsed.data.requestId, status: patch.status },
  });

  const { data: room } = await admin.from("deal_rooms").select("investor_user_id, title").eq("id", roomId).maybeSingle();
  if (room?.investor_user_id) {
    await createNotification({
      recipientUserId: room.investor_user_id,
      actorUserId: auth.profile.id,
      type: "deal_room_doc_fulfilled",
      title: "Document request updated",
      message: `Document request updated in deal room: ${room.title}`,
      entityType: "deal_room",
      entityId: roomId,
      deepLink: `/investor/deal-room/${roomId}`,
      dedupeKey: `deal_room_doc_fulfilled:${roomId}:${parsed.data.requestId}`,
    });
  }

  return NextResponse.json({ request: updated });
}

