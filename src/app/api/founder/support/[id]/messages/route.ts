import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addSupportMessage, getSupportThread } from "@/lib/support/support";
import { createNotification } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

const schema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  // RLS guarantees the founder can only post on their own request.
  const result = await addSupportMessage(supabase, {
    requestId: id,
    authorUserId: profile.id,
    authorRole: "founder",
    body: parsed.data.body,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // Ping the assigned staff member, if any.
  try {
    const thread = await getSupportThread(supabase, id);
    if (thread?.request.assigned_to) {
      await createNotification({
        recipientUserId: thread.request.assigned_to,
        type: "support_founder_reply",
        title: "Founder replied on a support request",
        message: thread.request.subject,
        entityType: "company",
        entityId: thread.request.company_id,
      });
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true });
}
