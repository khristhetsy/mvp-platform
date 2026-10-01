import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { cronMisconfiguredResponse, cronUnauthorizedResponse, getCronSecret, validateCronSecret } from "@/lib/notifications/cron/auth";
import { sendAiBudgetAlerts } from "@/lib/ai-budget/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Every 15 minutes: email when an AI budget (a category or the total) first reaches 80% or 100% this month. Gated by CRON_SECRET. */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  try {
    const result = await sendAiBudgetAlerts();
    const res = NextResponse.json({ ok: true, ...result });
    res.headers.set("x-cron-summary", result.sent.length ? `Sent: ${result.sent.join(", ")}` : "No new alerts");
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "AI budget alerts failed." }, { status: 500 });
  }
}
async function scheduledGET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/ai-budget-alerts", scheduledGET);
