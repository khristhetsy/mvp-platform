import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { loadAvailability, saveAvailability } from "@/lib/scheduling/store";

export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  const settings = await loadAvailability(auth.supabase, auth.profile.id);
  return NextResponse.json({ settings });
}

const ruleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});

const putSchema = z.object({
  timezone: z.string().min(1).max(64),
  slotMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(240),
  weeklyRules: z.array(ruleSchema).max(50),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (parsed.data.weeklyRules.some((r) => r.endMinute <= r.startMinute)) {
    return NextResponse.json({ error: "Each rule's endMinute must be after startMinute." }, { status: 400 });
  }

  const settings = await saveAvailability(auth.supabase, auth.profile.id, parsed.data);
  return NextResponse.json({ settings });
}
