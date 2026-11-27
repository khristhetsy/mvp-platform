import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { planMoveReminders } from "@/lib/billing/move-reminder";
import { MOVE_REMINDER_ENABLED_KEY, MOVE_REMINDER_WINDOW_KEY } from "@/lib/billing/move-reminder-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/billing/move-reminders: staff only dry run. Returns who the move reminder job
 * would email if it ran now, who already got this renewal's reminder, and who is skipped and
 * why. Reads only: it never sends and never records an event.
 */
export async function GET(): Promise<Response> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plan = await planMoveReminders();
    return NextResponse.json({
      dryRun: true,
      enabled: plan.enabled,
      enabledSetting: MOVE_REMINDER_ENABLED_KEY,
      windowDays: plan.windowDays,
      windowSetting: MOVE_REMINDER_WINDOW_KEY,
      checkedAt: new Date().toISOString(),
      wouldSend: plan.recipients,
      alreadySent: plan.alreadySent,
      skipped: plan.skipped,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Dry run failed." }, { status: 500 });
  }
}
