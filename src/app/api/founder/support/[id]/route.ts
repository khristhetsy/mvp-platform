import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupportThread, setSupportCsat } from "@/lib/support/support";
import { createNotification } from "@/lib/notifications/notifications";

export const dynamic = "force-dynamic";

const schema = z.object({ csat: z.union([z.literal(1), z.literal(-1)]) });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  // RLS restricts reads to the founder's own request.
  const thread = await getSupportThread(supabase, id);
  if (!thread || thread.request.founder_id !== profile.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(thread);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A rating is required." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const result = await setSupportCsat(supabase, id, parsed.data.csat);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // A thumbs-down flags the handling/assigned staff so they can follow up.
  if (parsed.data.csat === -1) {
    try {
      const thread = await getSupportThread(supabase, id);
      if (thread?.request.assigned_to) {
        await createNotification({
          recipientUserId: thread.request.assigned_to,
          type: "support_csat_negative",
          title: "A founder wasn't satisfied with support",
          message: thread.request.subject,
          entityType: "company",
          entityId: thread.request.company_id,
        });
      }
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.json({ ok: true });
}
