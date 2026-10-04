import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { runStep } from "@/lib/marketing/partner-outreach/store";

export const dynamic = "force-dynamic";

const schema = z.object({ enrollment_id: z.string().uuid(), action: z.enum(["send", "done", "skip"]) });

// POST: release one partner's due step (send the email, mark the task done, or skip).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { id } = await params;
  try {
    const r = await runStep(id, parsed.data.enrollment_id, parsed.data.action, profile.id);
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't run the step." }, { status: 500 });
  }
}
