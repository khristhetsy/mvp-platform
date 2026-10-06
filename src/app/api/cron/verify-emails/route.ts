import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { verifyBatch } from "@/lib/verify/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stop starting new batches after this long, so the run ends inside maxDuration. */
const TIME_BUDGET_MS = 40_000;
const BATCH = 100;

// Email verification: every 15 minutes (see vercel.json), works through contacts
// whose email is still "unverified" with the same free check as Marketing Hub ›
// Prospects › Verify & correct › Verify all contacts (domain mail records, company
// inbox detection; no paid service). Only sets email_status; never adds or changes
// an address. Pause it under Admin › System › Scheduled jobs. CRON_SECRET protected.
async function verifyEmailsGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const started = Date.now();
  const total = { batches: 0, verified: 0, valid: 0, risky: 0, invalid: 0, suppressed: 0, remaining: null as number | null };
  try {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const r = await verifyBatch(BATCH);
      total.batches++;
      total.verified += r.verified;
      total.valid += r.valid;
      total.risky += r.risky;
      total.invalid += r.invalid;
      total.suppressed += r.suppressed;
      total.remaining = r.remaining;
      // Queue empty, or a batch with nothing to check: done for this run.
      if (r.processed === 0 || r.remaining === 0 || (r.verified === 0 && r.suppressed === 0)) break;
    }
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ...total, error: err instanceof Error ? err.message : "Verification failed." }, { status: 500 });
  }
  const res = NextResponse.json(total);
  res.headers.set(CRON_SUMMARY_HEADER, `${total.verified} checked: ${total.valid} valid, ${total.risky} risky, ${total.invalid} invalid · ${total.remaining ?? "?"} left`);
  return res;
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/verify-emails", verifyEmailsGET);
