import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { dismissGap } from "@/lib/support/assistant-training";

export const dynamic = "force-dynamic";

const schema = z.object({ question: z.string().trim().min(3).max(200) });

/** Dismiss a gap: the question stays out of the Gaps to fill list. */
export async function POST(req: Request): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const ok = await dismissGap(parsed.data.question, profile.id);
  if (!ok) return NextResponse.json({ error: "Could not dismiss." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
