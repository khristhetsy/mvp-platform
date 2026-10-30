import { NextResponse } from "next/server";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runDbHealthCheck } from "@/lib/db-health/run";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Database health check, every 5 minutes (see vercel.json). Times a simple query,
// records connections and the longest running query, and opens an incident (and
// tells admins) when the database slows down. CRON_SECRET protected.
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const r = await runDbHealthCheck();
    const speed = r.responseMs === null ? "test query failed" : `${(r.responseMs / 1000).toFixed(2)} s`;
    const res = NextResponse.json({ ok: true, ...r });
    res.headers.set(CRON_SUMMARY_HEADER, `${r.state}, ${speed}${r.incident === "none" ? "" : `, incident ${r.incident}`}`);
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "check failed" }, { status: 500 });
  }
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/db-health", scheduledGET);
