import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addSupportMessage } from "@/lib/support/support";
import { onFounderReply } from "@/lib/support/care";

export const dynamic = "force-dynamic";

const schema = z.object({
  body: z.string().min(1).max(4000),
  attachments: z
    .array(z.object({ path: z.string().max(300), name: z.string().max(200), size: z.number().int().min(0) }))
    .max(5)
    .optional(),
});

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
    // Only files uploaded to this request's own folder can be attached.
    attachments: (parsed.data.attachments ?? []).filter((a) => a.path.startsWith(`${id}/`)),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  // Notify the assigned staff member and the notify list (Support queue,
  // Notifications), and log the reply. After the response, best effort.
  after(async () => {
    try {
      await onFounderReply(id, parsed.data.body);
    } catch {
      /* best effort */
    }
  });

  return NextResponse.json({ ok: true });
}
