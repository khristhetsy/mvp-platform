import { NextRequest, NextResponse } from "next/server";
import { runOperationsEscalations } from "@/lib/operations/escalations";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — cron-triggered (Vercel sends Authorization: Bearer ${CRON_SECRET}).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runOperationsEscalations();
  return NextResponse.json({ ok: true, ...result });
}

// POST — manual admin trigger (session auth), for testing on demand.
export async function POST(): Promise<NextResponse> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const result = await runOperationsEscalations();
  return NextResponse.json({ ok: true, ...result });
}
