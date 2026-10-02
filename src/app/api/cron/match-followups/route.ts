import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { marketingSendEnabled } from "@/lib/marketing/campaigns";
import { matchSequenceEnabled } from "@/lib/marketing/match-campaign/flag";
import { processMatchFollowups } from "@/lib/marketing/match-campaign/followups";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Match campaign follow ups: every 15 minutes (see vercel.json), sends the due
// follow up emails and creates the due call tasks. Does nothing unless
// MATCH_SEQUENCE_ENABLED=true; respects the MARKETING_SEND_LIVE kill switch.
// CRON_SECRET protected.
async function followupsGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  if (!matchSequenceEnabled()) return NextResponse.json({ skipped: "MATCH_SEQUENCE_ENABLED is off" });
  if (!marketingSendEnabled()) return NextResponse.json({ skipped: "MARKETING_SEND_LIVE is off" });
  const result = await processMatchFollowups().catch((err) => ({ error: err instanceof Error ? err.message : "run failed" }));
  return NextResponse.json(result);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/match-followups", followupsGET);
