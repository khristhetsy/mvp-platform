import { NextResponse } from "next/server";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { evaluateAlertRules } from "@/lib/social/alerts-eval";
import { materializeDueRecurrences } from "@/lib/social/recurrence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Social maintenance — hourly (see vercel.json). Split out of the 5-minute publish pass,
// where it was the single largest source of idle database load:
//
//   * evaluateAlertRules recomputes the funnel for every enabled grain on every run,
//     with no "has anything changed?" pre-check, and the funnel does two unbounded
//     crm_contacts JSONB scans per grain. At 288 runs/day that dominated everything else
//     the platform does. Alerts are per-period with a once-per-period fired guard, so
//     hourly evaluation detects exactly the same events.
//   * materializeDueRecurrences works against a 45-day horizon — it cannot have anything
//     newly due more often than once a day, let alone every five minutes.
//
// Publishing stayed on the 5-minute schedule because it is genuinely minute-sensitive.
export async function GET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  // Materialize first: a freshly-materialized post that is already due gets picked up by
  // the next publish pass, at most 5 minutes later.
  const recurrences = await materializeDueRecurrences().catch((err) => ({ error: err instanceof Error ? err.message : "recurrences failed" }));
  const alerts = await evaluateAlertRules().catch((err) => ({ error: err instanceof Error ? err.message : "alerts failed" }));
  return NextResponse.json({ recurrences, alerts });
}
