import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { cronMisconfiguredResponse, cronUnauthorizedResponse, getCronSecret, validateCronSecret } from "@/lib/notifications/cron/auth";
import { runIrSummaries } from "@/lib/ir/summaries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily: send the founder summaries that are due (weekly on Mondays, monthly at milestone end). Gated by CRON_SECRET. */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  try {
    const result = await runIrSummaries();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "IR summaries failed." }, { status: 500 });
  }
}
export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
