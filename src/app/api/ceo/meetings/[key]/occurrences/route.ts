import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createOccurrence } from "@/lib/ceo/meetings";

export const dynamic = "force-dynamic";

const schema = z.object({
  occursOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeLocal: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  durationMin: z.number().int().min(5).max(480).nullable().optional(),
  note: z.string().max(400).nullable().optional(),
});

// POST /api/ceo/meetings/[key]/occurrences — schedule a one-off occurrence.
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const { key } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const result = await createOccurrence(key, parsed.data, profile.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
