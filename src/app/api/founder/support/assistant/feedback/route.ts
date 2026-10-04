import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { logSupportEvent } from "@/lib/support/events";

export const dynamic = "force-dynamic";

const schema = z.object({ question: z.string().max(4000), solved: z.boolean() });

/**
 * "That solved it" / "I still need a person" under an assistant answer. Feeds
 * the Support log's "AI answers marked solved", the signal for how far the
 * assistant can be trusted to answer alone. "Still need a person" also opens
 * a request, from the client, through the normal handoff.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  await logSupportEvent({
    requestId: null,
    founderId: profile.id,
    actor: "founder",
    actorUserId: profile.id,
    kind: parsed.data.solved ? "ai_answer_solved" : "ai_answer_needs_person",
    summary: parsed.data.solved ? "Founder marked an AI answer: That solved it" : "Founder marked an AI answer: I still need a person",
    detail: parsed.data.question,
  });
  return NextResponse.json({ ok: true });
}
