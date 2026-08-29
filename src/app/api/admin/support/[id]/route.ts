import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addSupportMessage, assignSupportRequest, resolveSupportRequest, getSupportThread } from "@/lib/support/support";
import { createNotification } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const thread = await getSupportThread(supabase, id);
  if (!thread) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json(thread);
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), body: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("assign"), assigneeId: z.string().uuid().nullable() }),
  z.object({ action: z.literal("resolve") }),
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
    const r = await addSupportMessage(supabase, {
      requestId: id,
      authorUserId: profile.id,
      authorRole: "staff",
      body: parsed.data.body,
    });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    await createNotification({
      recipientUserId: thread.request.founder_id,
      type: "support_staff_reply",
      title: "Support replied to your request",
      message: thread.request.subject,
      entityType: "company",
      entityId: thread.request.company_id,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "assign") {
    const r = await assignSupportRequest(supabase, id, parsed.data.assigneeId);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    if (parsed.data.assigneeId) {
      await createNotification({
        recipientUserId: parsed.data.assigneeId,
        type: "support_assigned",
        title: "A support request was assigned to you",
        message: thread.request.subject,
        entityType: "company",
        entityId: thread.request.company_id,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  // resolve
  const r = await resolveSupportRequest(supabase, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  await createNotification({
    recipientUserId: thread.request.founder_id,
    type: "support_resolved",
    title: "Your support request was resolved",
    message: thread.request.subject,
    entityType: "company",
    entityId: thread.request.company_id,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
