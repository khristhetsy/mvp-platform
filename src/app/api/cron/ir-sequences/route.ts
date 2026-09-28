import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runDueSequences } from "@/lib/ir/sequences";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// IR auto sequences: every 15 minutes (see vercel.json), sends the steps whose time has
// come. CRON_SECRET protected.
async function sequencesGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runDueSequences().catch((err) => ({ error: err instanceof Error ? err.message : "run failed" }));
  return NextResponse.json(result);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/ir-sequences", sequencesGET);
