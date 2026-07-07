import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  suggestionKey: z.string().min(1).max(200),
  action: z.enum(["dismissed", "snoozed"]),
  snoozeHours: z.number().int().min(1).max(720).optional(),
});

// POST /api/admin/playbook/advisory/action — persist a dismiss/snooze for the caller.
export async function POST(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { suggestionKey, action, snoozeHours } = parsed.data;
    const snoozeUntil = action === "snoozed" ? new Date(Date.now() + (snoozeHours ?? 24) * 3600 * 1000).toISOString() : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = serviceRoleClientUntyped();
    const { error } = await db
      .from("ops_advisory_actions")
      .upsert({ admin_id: profile.id, suggestion_key: suggestionKey, action, snooze_until: snoozeUntil, created_at: new Date().toISOString() }, { onConflict: "admin_id,suggestion_key" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
