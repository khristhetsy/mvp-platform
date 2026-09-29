import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { loadAdminCompanyMatchProfiles } from "@/lib/matching/load-matching-data";
import { loadMatchingThresholds, saveMatchingThresholds } from "@/lib/matching/matching-thresholds";
import { THRESHOLD_MAX, THRESHOLD_MIN } from "@/lib/matching/matching-thresholds-shared";

export const dynamic = "force-dynamic";

const value = z.number().int().min(THRESHOLD_MIN).max(THRESHOLD_MAX);
const bodySchema = z.object({ readiness: value, match: value });

/**
 * GET: the matching pass thresholds, and today's readiness score of every scored
 * company (the same scores the pass reads), for the live counts.
 * POST { readiness, match }: save them. System access only.
 */
export async function GET() {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;
  const [thresholds, companies] = await Promise.all([loadMatchingThresholds(), loadAdminCompanyMatchProfiles().catch(() => [])]);
  const scores = companies
    .map((c) => c.readinessScore)
    .filter((s): s is number => typeof s === "number")
    .sort((a, b) => b - a);
  return NextResponse.json({ thresholds, scores });
}

export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_integrations");
  if ("error" in auth) return auth.error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Both values must be whole numbers from ${THRESHOLD_MIN} to ${THRESHOLD_MAX}.` }, { status: 400 });
  }
  const before = await loadMatchingThresholds();
  if (!(await saveMatchingThresholds(parsed.data, auth.profile.id))) {
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "matching.thresholds_changed",
    entityType: "scheduled_job",
    metadata: { job: "/api/cron/matching", before, after: parsed.data },
  }).catch(() => {});
  return NextResponse.json({ ok: true, thresholds: parsed.data });
}
