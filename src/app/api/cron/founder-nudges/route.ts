import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import * as Sentry from "@sentry/nextjs";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runDataRoomReminderPass } from "@/lib/data-room/reminder-pass";
import { nudgeStalledJourneyFounders } from "@/lib/notifications/founder-nudges";
import { runStageGateReminderPass } from "@/lib/notifications/stage-gate-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily founder nudges: the data room reminder cadence, stalled journey nudges
 * and stage gate reminders. These used to run at the end of
 * /api/cron/run-orchestration, which hits its 60 second limit before reaching
 * them, so they never finished (last data room reminder: 2026-07-14). Here they
 * have their own budget and do not depend on the orchestration pass.
 *
 * Each pass is independent and best effort: one failing does not stop the next.
 * Copy, cadence and dedupe are unchanged; the passes are called exactly as before.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const safe = async <T,>(name: string, run: () => Promise<T>): Promise<T | { error: string }> => {
    try {
      return await run();
    } catch (err) {
      Sentry.captureException(err, { tags: { pass: name } });
      return { error: err instanceof Error ? err.message.slice(0, 200) : `${name} failed` };
    }
  };

  const dataRoomReminders = await safe("data_room_reminders", runDataRoomReminderPass);
  const journeyNudges = await safe("journey_nudges", nudgeStalledJourneyFounders);
  const gateReminders = await safe("stage_gate_reminders", runStageGateReminderPass);

  return NextResponse.json({ ok: true, dataRoomReminders, journeyNudges, gateReminders });
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/founder-nudges", scheduledGET);
