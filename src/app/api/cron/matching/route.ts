import { NextResponse } from "next/server";
import { validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse, getCronSecret } from "@/lib/notifications/cron/auth";
import { runMatchingPass, promoteSuggestedMatches } from "@/lib/matching/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Lane B matching pass. Protected by CRON_SECRET (Bearer). Generates `suggested`
 * matches for eligible founders × approved investors, then promotes them to
 * `investor_notified` so they surface as anonymized cards.
 *
 * Schedule via vercel.json, e.g. GET /api/cron/matching daily.
 */
export async function GET(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const pass = await runMatchingPass();
    const promotion = await promoteSuggestedMatches();
    return NextResponse.json({ ok: true, ...pass, promoted: promotion.promoted });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Matching pass failed." },
      { status: 500 },
    );
  }
}
