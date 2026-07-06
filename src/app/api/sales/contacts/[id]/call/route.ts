import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { logActivity } from "@/lib/sales/activity";

export const dynamic = "force-dynamic";

const schema = z.object({
  outcome: z.enum(["connected", "voicemail", "no_answer", "wrong_number"]),
  duration: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const LABEL: Record<string, string> = { connected: "connected", voicemail: "voicemail", no_answer: "no answer", wrong_number: "wrong number" };

// POST /api/sales/contacts/[id]/call — log a call outcome to the activity timeline.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid call." }, { status: 400 });
  const { outcome, duration, notes } = parsed.data;
  const parts = [`Call — ${LABEL[outcome]}`];
  if (duration) parts.push(duration);
  if (notes) parts.push(`"${notes.trim()}"`);
  await logActivity({ kind: "call", summary: parts.join(" · "), actorId: profile.id, contactCrmId: id, meta: { outcome, duration: duration ?? null } });
  return NextResponse.json({ ok: true });
}
