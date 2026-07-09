import { NextResponse } from "next/server";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runCronOrchestrationPass } from "@/lib/notifications/orchestration/run-cron-pass";
import { captureCompanyMetricSnapshots } from "@/lib/investor/metric-snapshots";
import { runDataRoomReminderPass } from "@/lib/data-room/reminder-pass";
import { refreshPartnerScoreSnapshots } from "@/lib/investor-rating/snapshot";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** Best-effort daily metric snapshot. Never allowed to fail the cron pass. */
async function captureMetricSnapshotsSafely(): Promise<{ captured: number } | { error: string }> {
  try {
    return await captureCompanyMetricSnapshots(createServiceRoleClient());
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 200) : "snapshot failed" };
  }
}

/** Best-effort data-room reminder cadence. Never allowed to fail the cron pass. */
async function runDataRoomRemindersSafely() {
  try {
    return await runDataRoomReminderPass();
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 200) : "data-room reminders failed" };
  }
}

/** Best-effort partner-score snapshot refresh. Never allowed to fail the cron pass. */
async function refreshPartnerScoresSafely(): Promise<{ refreshed: number } | { error: string }> {
  try {
    return await refreshPartnerScoreSnapshots(createServiceRoleClient());
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

  try {
    const result = await runCronOrchestrationPass({ triggerSource: "cron", forceDigest });
    const snapshots = await captureMetricSnapshotsSafely();
    const dataRoomReminders = await runDataRoomRemindersSafely();
    const partnerScores = await refreshPartnerScoresSafely();
    return NextResponse.json({ ...result, snapshots, dataRoomReminders, partnerScores }, { status: result.success ? 200 : 207 });
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
