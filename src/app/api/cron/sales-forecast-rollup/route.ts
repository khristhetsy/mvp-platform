import { NextResponse } from "next/server";
import { getCronSecret, validateCronSecret, cronMisconfiguredResponse, cronUnauthorizedResponse } from "@/lib/notifications/cron/auth";
import { requireRole } from "@/lib/supabase/auth";
import { addSystemJournalEntry } from "@/lib/forecast/journal";
import { getComparison } from "@/lib/forecast/comparison";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runRollup(): Promise<{ newOpportunities: number; week: string | null }> {
  const weekly = await getComparison("weekly");
  const cur = weekly.current;
  const n = cur?.count ?? 0;
  await addSystemJournalEntry(`Weekly rollup${cur ? ` (${cur.label})` : ""}: ${n} new opportunit${n === 1 ? "y" : "ies"} created this week.`);
  return { newOpportunities: n, week: cur?.label ?? null };
}

// Scheduled weekly (vercel.json). Cron-secret protected.
export async function GET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  return NextResponse.json(await runRollup());
}

// Manual trigger for staff.
export async function POST(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json(await runRollup());
}
