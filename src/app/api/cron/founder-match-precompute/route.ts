import { NextResponse } from "next/server";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse, getCronSecret } from "@/lib/notifications/cron/auth";
import { getBoolSetting } from "@/lib/settings/platform-settings";
import { computeFounderMatches, MATCH_PRECOMPUTE_KEY } from "@/lib/matching/founder-match-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily: read the whole investor network once, score every founder, and store each
 * founder's best investors for the board and automated outreach. Protected by
 * CRON_SECRET. Does nothing while the `match_precompute` setting is off.
 */
async function scheduledGET(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    if (!(await getBoolSetting(MATCH_PRECOMPUTE_KEY, false))) {
      return NextResponse.json({ ok: true, skipped: "match_precompute is off" }, { headers: { [CRON_SUMMARY_HEADER]: "Off, nothing computed" } });
    }
    const summary = await computeFounderMatches();
    const text = summary.ok
      ? `${summary.written} founders, ${summary.networkSize} investors, ${Math.round((summary.readMs + summary.scoreMs + summary.writeMs) / 100) / 10}s`
      : (summary.error ?? "Failed");
    return NextResponse.json(summary, { status: summary.ok ? 200 : 500, headers: { [CRON_SUMMARY_HEADER]: text } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Precompute failed." }, { status: 500 });
  }
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/founder-match-precompute", scheduledGET);
