import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listSchedule, createScheduleItem, updateScheduleItem } from "@/lib/meetings/campaigns";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  week_start: z.string().min(4), topic: z.string().min(2).max(300), audience: z.string().min(2).max(120),
  platform: z.enum(["resend", "sendgrid"]).optional(), scheduled_date: z.string().nullable().optional(),
});
const patchSchema = z.object({
  id: z.string().uuid(), topic: z.string().max(300).optional(), audience: z.string().max(120).optional(),
  scheduled_date: z.string().nullable().optional(), status: z.enum(["draft", "scheduled", "sent"]).optional(),
});

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ schedule: await listSchedule() });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid schedule item." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, id: await createScheduleItem(parsed.data, profile.id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const { id, ...patch } = parsed.data;
  try {
    await updateScheduleItem(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
