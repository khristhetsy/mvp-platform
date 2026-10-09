import { NextRequest, NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { runOperationsEscalations } from "@/lib/operations/escalations";
import { requireRole } from "@/lib/supabase/auth";
import { checkUnopenedWelcomeLetters } from "@/lib/notifications/welcome-letter-watch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — cron-triggered (Vercel sends Authorization: Bearer ${CRON_SECRET}).
async function scheduledGET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runOperationsEscalations();
  // Daily: welcome letters still unopened 2 days after a client paid.
  const welcomeLetters = await checkUnopenedWelcomeLetters();
  return NextResponse.json({ ok: true, ...result, welcomeLetters });
}

// POST — manual admin trigger (session auth), for testing on demand.
export async function POST(): Promise<NextResponse> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const result = await runOperationsEscalations();
  return NextResponse.json({ ok: true, ...result });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/operations-escalations", scheduledGET);
