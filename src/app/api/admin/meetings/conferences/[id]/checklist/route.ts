import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { applyChecklist, listConferenceChecklist } from "@/lib/meetings/checklists";

export const dynamic = "force-dynamic";

// GET — the conference's checklist tasks + progress.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  return NextResponse.json(await listConferenceChecklist(id));
}

const schema = z.object({ template_id: z.string().uuid() });

// POST — apply a checklist template (bulk-inserts dated tasks).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid template." }, { status: 400 });
  try {
    return NextResponse.json(await applyChecklist(id, parsed.data.template_id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to apply checklist." }, { status: 500 });
  }
}
