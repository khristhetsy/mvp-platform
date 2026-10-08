import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runDueScheduledEmails } from "@/lib/scheduled-emails/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Schedule send (Contracts, Gmail, Draft email, Investor Relations, Sales chatter,
// Mass email): every 5 minutes (see vercel.json), sends the emails whose time has
// come through their own send routes. CRON_SECRET protected.
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const result = await runDueScheduledEmails().catch((err) => ({ error: err instanceof Error ? err.message : "run failed" }));
  return NextResponse.json(result);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/scheduled-emails", scheduledGET);
