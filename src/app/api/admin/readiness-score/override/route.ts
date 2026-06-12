/**
 * POST /api/admin/readiness-score/override
 *
 * Admin sets or clears a manual score override for a company.
 * Override takes precedence over AI score via `effective_score` generated column.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";

const schema = z.object({
  scoreId: z.string().uuid(),
  overrideScore: z.number().int().min(0).max(100).nullable(),
  overrideReason: z.string().max(500).nullable(),
});

export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin"]);

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid override request." }, { status: 400 });
  }

  const { scoreId, overrideScore, overrideReason } = parsed.data;

  const { data: updated, error } = await auth.supabase
    .from("company_readiness_scores")
    .update({
      override_score: overrideScore,
      override_reason: overrideReason,
      overridden_by: overrideScore !== null ? auth.profile.id : null,
      overridden_at: overrideScore !== null ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scoreId)
    .select("id, company_id, total_score, override_score, effective_score")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: overrideScore !== null ? "readiness_score.override_set" : "readiness_score.override_cleared",
    entityType: "company_readiness_score",
    entityId: scoreId,
    metadata: { overrideScore, overrideReason },
  });

  return NextResponse.json({ score: updated });
}
