import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/sales/activity";

export const dynamic = "force-dynamic";

const schema = z.object({ channel: z.enum(["call", "email", "message"]) });
const LABEL: Record<string, string> = { call: "Call started", email: "Email opened", message: "Text message opened" };

// POST /api/sales/opportunities/[id]/touch — log a call/email/message from the opportunity.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid." }, { status: 400 });
  await logActivity({ kind: parsed.data.channel, summary: LABEL[parsed.data.channel], actorId: profile.id, opportunityId: id });
  return NextResponse.json({ ok: true });
}
