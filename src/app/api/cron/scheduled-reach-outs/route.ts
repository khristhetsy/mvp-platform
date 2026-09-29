import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runDueScheduledReachOuts } from "@/lib/founder-outreach/scheduled-reach-outs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Scheduled "Reach out to founder" emails: every 5 minutes (see vercel.json), sends
// the ones whose time has come. CRON_SECRET protected.
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const result = await runDueScheduledReachOuts().catch((err) => ({ error: err instanceof Error ? err.message : "run failed" }));
  return NextResponse.json(result);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/scheduled-reach-outs", scheduledGET);
