import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createSession } from "@/lib/ceo/meetings";

export const dynamic = "force-dynamic";

const schema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendance: z.string().max(120).nullable().optional(),
  note: z.string().max(6000).nullable().optional(),
  decisions: z.array(z.string().min(1).max(500)).max(30).optional(),
  tasks: z.array(z.string().min(1).max(300)).max(30).optional(),
});

// POST /api/ceo/meetings/[key]/sessions — add a journal entry; tasks write through to admin_tasks.
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const { key } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const result = await createSession(key, parsed.data, profile.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
