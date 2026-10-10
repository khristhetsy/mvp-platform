import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runWireInvoiceCron } from "@/lib/billing/wire";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily Premium wire pass: awaiting invoices past due become overdue; wire paid
 * Premium subscribers get a renewal invoice 7 days before their period ends;
 * invoices overdue more than 10 days pause Premium once the period has ended.
 */
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  const result = await runWireInvoiceCron();
  return NextResponse.json({ ok: result.errors.length === 0, ...result });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/wire-invoices", scheduledGET);
