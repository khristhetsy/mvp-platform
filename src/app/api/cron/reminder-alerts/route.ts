import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { sendDueReminderAlerts } from "@/lib/reminders/alerts";

export const maxDuration = 60;

async function handleCron(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const result = await sendDueReminderAlerts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Reminder alert pass failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function scheduledGET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/reminder-alerts", scheduledGET);
