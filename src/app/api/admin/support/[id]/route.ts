import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addSupportMessage, assignSupportRequest, resolveSupportRequest, getSupportThread, staffSupportLink, founderSupportLink } from "@/lib/support/support";
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
  return NextResponse.json({ ...thread, events: await listRequestEvents(id) });
}

const schema = z.discriminatedUnion("action", [
  // aiDraft: the AI draft the reply started from, so the log can say whether it was edited.
  z.object({ action: z.literal("reply"), body: z.string().min(1).max(4000), aiDraft: z.string().max(4000).nullish() }),
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
    const r = await addSupportMessage(supabase, {
      requestId: id,
      authorUserId: profile.id,
      authorRole: "staff",
      body,
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
        await onStaffReply(id, profile.id, body, aiDraft);
      } catch {
        /* best effort */
      }
    });
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
