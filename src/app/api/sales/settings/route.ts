import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getSalesSettings, updateSalesSettings } from "@/lib/sales/settings";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ settings: await getSalesSettings() });
}

const schema = z.object({
  taskTypes: z.array(z.string().min(1).max(40)).max(30).optional(),
  remindTaskDue: z.boolean().optional(),
  remindStalled: z.boolean().optional(),
  stalledDays: z.number().int().min(1).max(90).optional(),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  try {
    await updateSalesSettings(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
