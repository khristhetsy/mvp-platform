import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { getHubSettings, updateHubSettings } from "@/lib/playbook/hub-settings";
import { getOpsSettings, updateOpsSettings } from "@/lib/operations/settings";

export const dynamic = "force-dynamic";

const schema = z.object({
  driftDetection: z.boolean().optional(),
  driftAutoAdd: z.boolean().optional(),
  advisoryEnabled: z.boolean().optional(),
  runResetTz: z.string().max(60).optional(),
  escalationPastDueDays: z.number().int().min(7).max(60).optional(),
  playbookEditScope: z.enum(["all_admins", "owner_only"]).optional(),
});

// GET /api/admin/playbook/settings — read hub settings.
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin", "analyst"]);
    return NextResponse.json(await getHubSettings());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

// PATCH — update hub settings; enforces playbook_edit_scope. In owner_only mode only
// the designated ops manager (ops_settings.default_manager_id) may edit.
export async function PATCH(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin", "analyst"]);
    if (profile.role !== "admin") return NextResponse.json({ error: "Read-only role — editing requires an admin." }, { status: 403 });

    const [current, ops] = await Promise.all([getHubSettings(), getOpsSettings()]);
    if (current.playbookEditScope === "owner_only" && ops.defaultManagerId && ops.defaultManagerId !== profile.id) {
      return NextResponse.json({ error: "Editing is limited to the workspace owner while scope is set to Owner only." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

    await updateHubSettings(parsed.data);
    // The escalation threshold is the single source for the onboarding SLA the cron reads.
    if (parsed.data.escalationPastDueDays !== undefined) {
      await updateOpsSettings({ onboardingSlaDays: parsed.data.escalationPastDueDays }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
