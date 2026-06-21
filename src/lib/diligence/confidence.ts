// Confidence score (§11) — severity-weighted: claims linked to a high-severity
// finding count double. Pure core (testable) + a DB wrapper.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Severity, Verification } from "./types";

export type ConfidenceClaim = {
  verification: Verification;
  weight: number;
  finding_id: string | null;
};

/** High-severity-linked claims weigh double. Returns 0–100 (rounded). */
export function computeConfidencePure(
  claims: ConfidenceClaim[],
  severityByFinding: Record<string, Severity>,
): number {
  const effective = (c: ConfidenceClaim) =>
    c.weight * (c.finding_id && severityByFinding[c.finding_id] === "high" ? 2 : 1);

  const total = claims.reduce((s, c) => s + effective(c), 0) || 1;
  const verified = claims
    .filter((c) => c.verification === "verified")
    .reduce((s, c) => s + effective(c), 0);

  return Math.round((100 * verified) / total);
}

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Recompute confidence for an engagement from its claims + finding severities. */
export async function computeConfidence(
  supabase: SupabaseClient<Database>,
  engagementId: string,
): Promise<number> {
  const [{ data: claims }, { data: findings }] = await Promise.all([
    raw(supabase).from("dd_claims").select("verification, weight, finding_id").eq("engagement_id", engagementId),
    raw(supabase).from("dd_findings").select("id, severity").eq("engagement_id", engagementId),
  ]);

  const severityByFinding: Record<string, Severity> = {};
  for (const f of (findings ?? []) as Array<{ id: string; severity: Severity }>) {
    severityByFinding[f.id] = f.severity;
  }

  return computeConfidencePure((claims ?? []) as ConfidenceClaim[], severityByFinding);
}
