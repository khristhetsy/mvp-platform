import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { isCronPath } from "@/lib/cron/jobs";
import { DISPATCHER_PATH, saveScheduleOverride, triggerJob } from "@/lib/cron/schedule-overrides";
import { validCustomCron, zonedLocalToUtc } from "@/lib/cron/zoned-schedule";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    job: z.string().min(1),
    /** Custom schedule in Pacific time, or null to keep the vercel.json one. */
    cron: z.array(z.string().min(1)).max(6).nullable(),
    /** One-off next run as a Pacific wall clock "YYYY-MM-DDTHH:MM", or null. */
    nextRunLocal: z.string().nullable(),
  }),
  z.object({ action: z.literal("reset"), job: z.string().min(1) }),
  z.object({ action: z.literal("run-now"), job: z.string().min(1) }),
]);

/**
 * POST /api/admin/scheduled-jobs/schedule: change when a job runs.
 * save: custom schedule and/or one-off next run. reset: back to vercel.json.
 * run-now: start it straight away. System access only.
 */
export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send a job and an action." }, { status: 400 });
  const body = parsed.data;
  if (!isCronPath(body.job) || body.job === DISPATCHER_PATH) {
    return NextResponse.json({ error: "This job's schedule can't be changed here." }, { status: 400 });
  }

  const audit = (action: string, metadata: Record<string, unknown>) =>
    writeAuditLog(auth.supabase, { userId: auth.profile.id, action, entityType: "scheduled_job", metadata: { job: body.job, ...metadata } }).catch(() => {});

  if (body.action === "run-now") {
    const res = await triggerJob(body.job);
    if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't start the job." }, { status: 502 });
    await audit("scheduled_job.run_now", {});
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reset") {
    if (!(await saveScheduleOverride(body.job, { cron: null, nextRunAt: null }, auth.profile.id))) {
      return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
    }
    await audit("scheduled_job.schedule_reset", {});
    return NextResponse.json({ ok: true });
  }

  if (body.cron && !validCustomCron(body.cron)) {
    return NextResponse.json({ error: "That schedule isn't valid. Jobs can run at most every 5 minutes." }, { status: 400 });
  }
  let nextRunAt: Date | null = null;
  if (body.nextRunLocal) {
    nextRunAt = zonedLocalToUtc(body.nextRunLocal);
    if (!nextRunAt) return NextResponse.json({ error: "That next run time isn't valid." }, { status: 400 });
    if (nextRunAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "The next run is in the past. Pick a later time, or use Run now." }, { status: 400 });
  }
  if (!(await saveScheduleOverride(body.job, { cron: body.cron, nextRunAt }, auth.profile.id))) {
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  await audit("scheduled_job.schedule_changed", { cron: body.cron, nextRunAt: nextRunAt?.toISOString() ?? null });
  return NextResponse.json({ ok: true });
}
