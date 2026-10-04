import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { matchCampaignsEnabled } from "@/lib/marketing/match-campaign/flag";
import { runDailyRematch } from "@/lib/marketing/match-campaign/rematch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Match campaign daily rematch: 23:30 UTC (see vercel.json), half an hour before
// the daily send limit resets, so each day's batch goes out with fresh matches.
// Only campaigns with "Refresh matches daily" on; only founders not yet emailed.
// Does nothing unless MATCH_CAMPAIGNS_ENABLED=true. CRON_SECRET protected.
async function rematchGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  if (!matchCampaignsEnabled()) return NextResponse.json({ skipped: "MATCH_CAMPAIGNS_ENABLED is off" });
  // Leave headroom under maxDuration for the last batch and the response.
  const result = await runDailyRematch(Date.now() + 240_000).catch((err) => ({ error: err instanceof Error ? err.message : "run failed" }));
  return NextResponse.json(result);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/match-rematch", rematchGET);
