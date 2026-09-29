import { NextResponse } from "next/server";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runDueScheduleOverrides } from "@/lib/cron/schedule-overrides";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Every 5 minutes (see vercel.json): starts jobs whose custom schedule or one-off
// next run (Admin, System, Scheduled jobs, Edit) has come. CRON_SECRET protected.
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const result = await runDueScheduleOverrides().catch((err) => ({ started: [], error: err instanceof Error ? err.message : "run failed" }));
  return NextResponse.json(result, {
    headers: { [CRON_SUMMARY_HEADER]: result.started.length ? `Started ${result.started.length}: ${result.started.join(", ")}` : "Nothing due" },
  });
}

export const GET = withCronGate("/api/cron/job-dispatcher", scheduledGET);
