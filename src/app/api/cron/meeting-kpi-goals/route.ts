import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronMisconfiguredResponse, cronUnauthorizedResponse } from "@/lib/notifications/cron/auth";
import { requireRole } from "@/lib/supabase/auth";
import { refreshGoals } from "@/lib/meetings/kpi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Monday 06:00 PT — recompute + materialize KPI auto-goals.
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  try {
    return NextResponse.json({ refreshed: await refreshGoals() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message.slice(0, 200) : "refresh failed" }, { status: 500 });
  }
}

export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ refreshed: await refreshGoals() });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/meeting-kpi-goals", scheduledGET);
