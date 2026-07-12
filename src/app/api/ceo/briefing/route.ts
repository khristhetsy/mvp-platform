import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runBriefing } from "@/lib/ceo/briefing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — Vercel cron. Weekly (full) on Mondays, light run other days.
export async function GET(req: NextRequest): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(req)) return cronUnauthorizedResponse();
  const mode = new Date().getUTCDay() === 1 ? "weekly" : "daily";
  try {
    return NextResponse.json(await runBriefing(mode));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Briefing failed." }, { status: 500 });
  }
}

// POST — manual admin trigger. ?mode=weekly|daily (default weekly for a manual run).
export async function POST(req: NextRequest): Promise<Response> {
  // requireRole uses Next's redirect() (which throws NEXT_REDIRECT) on a role/session
  // miss. Do the auth OUTSIDE the run try/catch so an auth failure isn't swallowed into
  // an opaque 500 — let Next handle the redirect (client sees a clean auth response).
  await requireRole(["admin"]);
  const mode = req.nextUrl.searchParams.get("mode") === "daily" ? "daily" : "weekly";
  try {
    return NextResponse.json(await runBriefing(mode));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Briefing failed." }, { status: 500 });
  }
}
