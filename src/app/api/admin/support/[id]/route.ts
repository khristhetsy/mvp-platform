import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addSupportMessage, assignSupportRequest, resolveSupportRequest, getSupportThread, staffSupportLink, founderSupportLink, setSupportStatus, setSupportPriority } from "@/lib/support/support";
import { loadTicketContext } from "@/lib/support/ticket-context";
import { logSupportEvent } from "@/lib/support/events";
import { onAssigned, onResolved, onStaffReply } from "@/lib/support/care";
import { listRequestEvents } from "@/lib/support/events";
import { createNotification } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const thread = await getSupportThread(supabase, id);
  if (!thread) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const [events, context] = await Promise.all([listRequestEvents(id), loadTicketContext(thread.request).catch(() => null)]);
  return NextResponse.json({ ...thread, events, context });
}

const attachment = z.object({ path: z.string().min(1).max(300), name: z.string().min(1).max(160), size: z.number().int().min(0) });

const schema = z.discriminatedUnion("action", [
  // aiDraft: the AI draft the reply started from, so the log can say whether it was edited.
  z.object({
    action: z.literal("reply"),
    body: z.string().min(1).max(4000),
    aiDraft: z.string().max(4000).nullish(),
    attachments: z.array(attachment).max(5).optional(),
    resolveAfter: z.boolean().optional(),
  }),
  z.object({ action: z.literal("note"), body: z.string().min(1).max(4000), attachments: z.array(attachment).max(5).optional() }),
  z.object({ action: z.literal("status"), status: z.enum(["open", "pending_founder"]) }),
  z.object({ action: z.literal("priority"), priority: z.enum(["low", "normal", "high"]) }),
  z.object({ action: z.literal("assign"), assigneeId: z.string().uuid().nullable() }),
  z.object({ action: z.literal("resolve"), summary: z.string().max(2000).nullish(), aiSummary: z.string().max(2000).nullish() }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // Staff RLS (is_staff()) authorizes these writes on the cookie-scoped client.
  const supabase = await createServerSupabaseClient();
  const thread = await getSupportThread(supabase, id);
  if (!thread) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  if (parsed.data.action === "reply") {
    const body = parsed.data.body;
    const aiDraft = parsed.data.aiDraft ?? null;
    const files = (parsed.data.attachments ?? []).filter((a) => a.path.startsWith(`${id}/`));
    const r = await addSupportMessage(supabase, {
      requestId: id,
      authorUserId: profile.id,
      authorRole: "staff",
      body,
      attachments: files,
    });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    await createNotification({
      recipientUserId: thread.request.founder_id,
      type: "support_staff_reply",
      title: "Support replied to your request",
      message: thread.request.subject,
      entityType: "company",
      entityId: thread.request.company_id,
      deepLink: founderSupportLink(id),
    }).catch(() => {});
    // Email the founder, keep the promised time honest, log it.
    after(async () => {
      try {
        await onStaffReply(id, profile.id, body, aiDraft, files.map((f) => f.name));
      } catch {
        /* best effort */
      }
    });
    if (parsed.data.resolveAfter) {
      const done = await resolveSupportRequest(supabase, id, null);
      if (!("error" in done)) {
        after(async () => {
          try {
            await onResolved(id, profile.id, null, null);
          } catch {
            /* best effort */
          }
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "note") {
    const files = (parsed.data.attachments ?? []).filter((a) => a.path.startsWith(`${id}/`));
    const r = await addSupportMessage(supabase, {
      requestId: id,
      authorUserId: profile.id,
      authorRole: "staff",
      body: parsed.data.body,
      internal: true,
      attachments: files,
    });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    await logSupportEvent({
      requestId: id,
      founderId: thread.request.founder_id,
      actor: "staff",
      actorUserId: profile.id,
      kind: "internal_note",
      summary: `${profile.full_name ?? "Staff"} added an internal note`,
      detail: parsed.data.body,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "status") {
    const r = await setSupportStatus(supabase, id, parsed.data.status);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    await logSupportEvent({
      requestId: id,
      founderId: thread.request.founder_id,
      actor: "staff",
      actorUserId: profile.id,
      kind: "status_changed",
      summary: `${profile.full_name ?? "Staff"} set it to ${parsed.data.status === "pending_founder" ? "Waiting on founder" : "Open"}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "priority") {
    const r = await setSupportPriority(supabase, id, parsed.data.priority);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    await logSupportEvent({
      requestId: id,
      founderId: thread.request.founder_id,
      actor: "staff",
      actorUserId: profile.id,
      kind: "priority_changed",
      summary: `${profile.full_name ?? "Staff"} set priority to ${parsed.data.priority}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "assign") {
    const assigneeId = parsed.data.assigneeId;
    const r = await assignSupportRequest(supabase, id, assigneeId);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    if (assigneeId) {
      await createNotification({
        recipientUserId: assigneeId,
        type: "support_assigned",
        title: "A support request was assigned to you",
        message: thread.request.subject,
        entityType: "company",
        entityId: thread.request.company_id,
        deepLink: staffSupportLink(id),
      }).catch(() => {});
    }
    after(async () => {
      try {
        await onAssigned(id, assigneeId, profile.id);
      } catch {
        /* best effort */
      }
    });
    return NextResponse.json({ ok: true });
  }

  // resolve: the summary goes to the founder with "Did this solve your issue?"
  const summary = parsed.data.summary ?? null;
  const aiSummary = parsed.data.aiSummary ?? null;
  const r = await resolveSupportRequest(supabase, id, summary);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  await createNotification({
    recipientUserId: thread.request.founder_id,
    type: "support_resolved",
    title: "Your support request was resolved",
    message: `${thread.request.subject}. Tell us if it's solved.`,
    entityType: "company",
    entityId: thread.request.company_id,
    deepLink: founderSupportLink(id),
  }).catch(() => {});
  after(async () => {
    try {
      await onResolved(id, profile.id, summary, aiSummary);
    } catch {
      /* best effort */
    }
  });
  return NextResponse.json({ ok: true });
}
