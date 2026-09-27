import { NextResponse } from "next/server";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse, getCronSecret } from "@/lib/notifications/cron/auth";
import { runMatchingPass, promoteSuggestedMatches } from "@/lib/matching/engine";
import { matchingSummary } from "@/lib/matching/matching-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Lane B matching pass. Protected by CRON_SECRET (Bearer). Generates `suggested`
 * matches for eligible founders × approved investors, then promotes them to
 * `investor_notified` so they surface as anonymized cards.
 *
 * Schedule via vercel.json, e.g. GET /api/cron/matching daily.
 */
async function scheduledGET(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const pass = await runMatchingPass();
    const promotion = await promoteSuggestedMatches();
    return NextResponse.json(
      { ok: true, ...pass, promoted: promotion.promoted },
      { headers: { [CRON_SUMMARY_HEADER]: matchingSummary(pass) } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Matching pass failed." },
      { status: 500 },
    );
  }
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/matching", scheduledGET);
