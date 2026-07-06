import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/sales/activity";

export const dynamic = "force-dynamic";

const schema = z.object({ channel: z.enum(["email", "message"]), note: z.string().max(300).optional().nullable() });
const LABEL: Record<string, string> = { email: "Email opened", message: "Text message opened" };

// POST /api/sales/contacts/[id]/touch — log an email/message action to the timeline.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid." }, { status: 400 });
  const summary = parsed.data.note ? `${LABEL[parsed.data.channel]} — ${parsed.data.note}` : LABEL[parsed.data.channel];
  await logActivity({ kind: parsed.data.channel, summary, actorId: profile.id, contactCrmId: id });
  return NextResponse.json({ ok: true });
}
