import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/ceo/planning";

export const dynamic = "force-dynamic";

// GET — the calling admin's CEO Hub notification preferences.
export async function GET(): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    return NextResponse.json(await getNotificationPrefs(profile.id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

const schema = z.object({ emailDaily: z.boolean().optional(), emailWeekly: z.boolean().optional() });

export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await updateNotificationPrefs(profile.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
