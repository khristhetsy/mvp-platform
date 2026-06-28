import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { sendFunnelDigestToAdmins } from "@/lib/analytics/funnel-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Weekly: email the activation-funnel report to staff. Gated by CRON_SECRET. */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const result = await sendFunnelDigestToAdmins();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message.slice(0, 200) : "Funnel digest failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
