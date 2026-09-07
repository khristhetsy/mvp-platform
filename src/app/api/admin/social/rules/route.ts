import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSocialSettings, getSlots } from "@/lib/social/queries";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const [settings, slots] = await Promise.all([getSocialSettings(), getSlots()]);
  return NextResponse.json({ settings, slots });
}

const patchSchema = z.object({
  settings: z.object({
    approve_before_publish: z.boolean().optional(),
    rewrite_per_account: z.boolean().optional(),
    skip_empty_slot: z.boolean().optional(),
    auto_publish: z.boolean().optional(),
    rotation: z.array(z.string()).max(6).optional(),
  }).optional(),
  addSlot: z.object({ weekday: z.number().int().min(0).max(6), time_local: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  removeSlotId: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid rules update." }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  if (parsed.data.settings) {
    await db.from("social_settings").update({ ...parsed.data.settings, updated_at: new Date().toISOString() }).eq("id", 1);
  }
  if (parsed.data.addSlot) {
    await db.from("social_slots").insert(parsed.data.addSlot);
  }
  if (parsed.data.removeSlotId) {
    await db.from("social_slots").delete().eq("id", parsed.data.removeSlotId);
  }
  const [settings, slots] = await Promise.all([getSocialSettings(), getSlots()]);
  return NextResponse.json({ settings, slots });
}
