import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getOpsSettings, updateOpsSettings } from "@/lib/operations/settings";
import { listAssignees } from "@/lib/operations/tasks";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const [settings, assignees] = await Promise.all([getOpsSettings(), listAssignees()]);
  return NextResponse.json({ settings, assignees });
}

const schema = z.object({
  onboardingSlaDays: z.number().int().min(1).max(90).optional(),
  diligenceSlaDays: z.number().int().min(1).max(90).optional(),
  defaultManagerId: z.string().uuid().nullable().optional(),
  emailEscalations: z.boolean().optional(),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  try {
    await updateOpsSettings(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
