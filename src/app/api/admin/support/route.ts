import { NextRequest, NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import {
  addSupportMessage,
  assignSupportRequest,
  createSupportRequest,
  requesterSupportLink,
  staffSupportLink,
} from "@/lib/support/support";
import { MANUAL_CHANNEL_LABELS, MANUAL_REQUESTER_ROLES, newMessageSchema } from "@/lib/support/manual-message";
import { logSupportEvent } from "@/lib/support/events";
import { onStaffReply } from "@/lib/support/care";
import { createNotification } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/support: staff start a conversation with a client.
 *
 * Creates a normal support request (source "manual") holding the staff message.
 * The client sees it on their Support page and replies there. Sent as iCFO
 * staff, never as the client. The service role client is used because a staff
 * member does not own the request row; staff access is checked first.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const parsed = newMessageSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Add a client, a subject and a message." }, { status: 400 });
  const input = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceRoleClient() as unknown as SupabaseClient<any>;

  const { data: reqRow } = await svc.from("profiles").select("id, role, is_active").eq("id", input.requesterId).maybeSingle();
  const requester = reqRow as { id: string; role: string; is_active: boolean | null } | null;
  if (!requester || requester.is_active === false || !(MANUAL_REQUESTER_ROLES as readonly string[]).includes(requester.role)) {
    return NextResponse.json({ error: "Pick a founder or investor." }, { status: 400 });
  }
  const requesterRole = requester.role as "founder" | "investor";

  // A founder's thread belongs to their company; an investor has none.
  let companyId: string | null = null;
  if (requesterRole === "founder") {
    const { data: comp } = await svc
      .from("companies")
      .select("id")
      .eq("founder_id", requester.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    companyId = (comp as { id: string } | null)?.id ?? null;
    if (!companyId) return NextResponse.json({ error: "That founder has no company yet." }, { status: 400 });
  }

  // The thread is assigned to the chosen staff member, or to the sender.
  let assigneeId = profile.id;
  if (input.assigneeId && input.assigneeId !== profile.id) {
    const { data: a } = await svc.from("profiles").select("id, role").eq("id", input.assigneeId).maybeSingle();
    const staff = a as { id: string; role: string } | null;
    if (staff && (staff.role === "admin" || staff.role === "analyst")) assigneeId = staff.id;
  }

  const db = svc as unknown as SupabaseClient<Database>;
  // Empty body: the first message is the staff message below, not a client message.
  const created = await createSupportRequest(db, {
    companyId,
    founderId: requester.id,
    requesterRole,
    subject: input.subject,
    body: "",
    source: "manual",
    priority: input.priority,
    contextItem: MANUAL_CHANNEL_LABELS[input.channel],
  });
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: 400 });
  const id = created.id;

  const sent = await addSupportMessage(db, { requestId: id, authorUserId: profile.id, authorRole: "staff", body: input.body });
  if ("error" in sent) {
    await svc.from("support_requests").delete().eq("id", id);
    return NextResponse.json({ error: `Couldn't save the message: ${sent.error}` }, { status: 400 });
  }
  await assignSupportRequest(db, id, assigneeId);

  const entityId = companyId ?? requester.id;
  await createNotification({
    recipientUserId: requester.id,
    type: "support_staff_reply",
    title: "New message from the iCapOS team",
    message: input.subject,
    entityType: "company",
    entityId,
    deepLink: requesterSupportLink(requesterRole, id),
  }).catch(() => {});
  if (assigneeId !== profile.id) {
    await createNotification({
      recipientUserId: assigneeId,
      type: "support_assigned",
      title: "A support request was assigned to you",
      message: input.subject,
      entityType: "company",
      entityId,
      deepLink: staffSupportLink(id),
    }).catch(() => {});
  }
  await logSupportEvent({
    requestId: id,
    founderId: requester.id,
    actor: "staff",
    actorUserId: profile.id,
    kind: "submitted",
    summary: `${profile.full_name ?? "Staff"} started this conversation`,
    detail: input.body,
    meta: { source: "manual", channel: input.channel, priority: input.priority, emailRequester: input.emailRequester },
  });

  // Email the client a link to the thread, from the assignee. Same path as a staff reply.
  if (input.emailRequester) {
    after(async () => {
      try {
        await onStaffReply(id, profile.id, input.body, null, []);
      } catch {
        /* best effort; the in app notification is already sent */
      }
    });
  }

  return NextResponse.json({ ok: true, id });
}
