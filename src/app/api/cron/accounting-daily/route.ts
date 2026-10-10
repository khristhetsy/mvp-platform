import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runAccountingDaily } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily Accounting pass, about 6 AM PT: emails scheduled invoices whose issue
 * date has come (the rest of a monthly series), then pulls new Bank of America
 * transactions through Plaid.
 */
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runAccountingDaily();
  return NextResponse.json({ ok: result.sendErrors.length === 0 && result.bank.errors.length === 0, ...result });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/accounting-daily", scheduledGET);
