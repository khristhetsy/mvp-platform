import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getHubSettings, todayInTz } from "@/lib/playbook/hub-settings";
import { setDailyCheck } from "@/lib/playbook/hub";

export const dynamic = "force-dynamic";

const schema = z.object({ surfaceId: z.string().uuid(), checked: z.boolean() });

// POST /api/admin/playbook/checks — upsert/delete the calling admin's check for today.
export async function POST(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const settings = await getHubSettings();
    const today = todayInTz(settings.runResetTz);
    await setDailyCheck(profile.id, parsed.data.surfaceId, parsed.data.checked, today);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
