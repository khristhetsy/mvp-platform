import { NextResponse } from "next/server";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runCronOrchestrationPass } from "@/lib/notifications/orchestration/run-cron-pass";
import { captureCompanyMetricSnapshots } from "@/lib/investor/metric-snapshots";
import { refreshPartnerScoreSnapshots } from "@/lib/investor-rating/snapshot";
import { digestStalledFoundersForStaff } from "@/lib/notifications/staff-journey-digest";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// Was 60, and every cron run since 2026-06-27 hit it and was killed (averaged
// 28s when runs last completed). 300 matches the other cron routes.
export const maxDuration = 300;

/** Best-effort daily metric snapshot. Never allowed to fail the cron pass. */
async function captureMetricSnapshotsSafely(): Promise<{ captured: number } | { error: string }> {
  try {
    return await captureCompanyMetricSnapshots(createServiceRoleClient());
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 200) : "snapshot failed" };
  }
}

/**
 * Best-effort partner-score snapshot refresh. Time-boxed via `deadlineMs` so it can
 * never exhaust the function's execution budget (a hard timeout would 504 the whole
 * cron). Investors not reached this run are picked up next pass. Never fails the pass.
 */
async function refreshPartnerScoresSafely(
  deadlineMs: number,
): Promise<{ refreshed: number; remaining: number } | { error: string }> {
  try {
    return await refreshPartnerScoreSnapshots(createServiceRoleClient(), { deadlineMs });
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 200) : "partner-score refresh failed" };
  }
}

async function handleCron(request: Request) {
  if (!getCronSecret()) {
    return cronMisconfiguredResponse();
  }

  if (!validateCronSecret(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const forceDigest = url.searchParams.get("forceDigest") === "true";

  const startedAt = Date.now();
  try {
    const result = await runCronOrchestrationPass({ triggerSource: "cron", forceDigest });
    const snapshots = await captureMetricSnapshotsSafely();
    // Data room reminders, journey nudges and stage gate reminders run in
    // /api/cron/founder-nudges with their own budget; this pass hit its 60s limit
    // before reaching them.
    // Leave ~30s of headroom under the function limit for the steps after the refresh.
    const partnerScores = await refreshPartnerScoresSafely(startedAt + (maxDuration - 30) * 1000);
    const journeyDigest = await digestStalledFoundersForStaff().catch(() => ({ staffNotified: 0, stalled: 0 }));
    return NextResponse.json({ ...result, snapshots, partnerScores, journeyDigest }, { status: result.success ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Orchestration pass failed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        remindersGenerated: 0,
        digestsGenerated: 0,
        escalationsDetected: 0,
        overdueWorkflowsDetected: 0,
        orchestrationSkippedDuplicates: 0,
        failuresCount: 1,
        errors: [{ step: "cron_pass", message }],
        runId: null,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
