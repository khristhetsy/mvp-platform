/**
 * /fit funnel diagnostics. The drop-off distribution (last_step) is the funnel's
 * primary signal (build-spec §6): where do arrivals quit? Aggregated server-side
 * from fit_sessions; service-role only.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type FunnelStats = {
  arrivals: number;
  /** Reached-at-least counts, step 0 (landed) → 5 (saw matches). */
  reached: { step: number; label: string; count: number }[];
  bySource: { tag: string; count: number }[];
  captured: number;
  /** Sessions that saw a match screen, split by whether any investor matched. */
  matched: number;
  zeroMatch: number;
};

const STEP_LABELS = ["Landed", "Answered Q1", "Answered Q2", "Answered Q3", "Answered Q4", "Saw matches"];

export async function getFunnelStats(): Promise<FunnelStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { data, error } = await db.from("fit_sessions").select("last_step, source_tag, email, matched_count").limit(50000);
  const rows = (error || !Array.isArray(data) ? [] : data) as { last_step: number | null; source_tag: string | null; email: string | null; matched_count: number | null }[];

  const arrivals = rows.length;
  const reached = STEP_LABELS.map((label, step) => ({
    step,
    label,
    count: rows.filter((r) => (r.last_step ?? 0) >= step).length,
  }));

  const sourceCounts = new Map<string, number>();
  for (const r of rows) {
    const tag = r.source_tag || "direct";
    sourceCounts.set(tag, (sourceCounts.get(tag) ?? 0) + 1);
  }
  const bySource = [...sourceCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);

  const captured = rows.filter((r) => r.email && r.email.trim()).length;
  const sawMatches = rows.filter((r) => (r.last_step ?? 0) >= 5);
  const matched = sawMatches.filter((r) => (r.matched_count ?? 0) > 0).length;
  const zeroMatch = sawMatches.length - matched;

  return { arrivals, reached, bySource, captured, matched, zeroMatch };
}
