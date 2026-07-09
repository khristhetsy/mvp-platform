import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadPartnerScore } from "./load";
import type { PartnerScore } from "./types";

// partner_score_snapshots isn't in the generated Supabase types yet; access it
// through a loosely-typed view rather than `any`.
function snap(admin: SupabaseClient<Database>): SupabaseClient {
  return admin as unknown as SupabaseClient;
}

/**
 * Read partner scores for a set of investors from the snapshot table in ONE query,
 * computing live only for investors that don't yet have a snapshot (first render
 * before the first cron refresh, or brand-new investors). Replaces the previous
 * per-investor N+1 of the ~7-query loadPartnerScore().
 */
export async function loadPartnerScoresBatch(
  admin: SupabaseClient<Database>,
  investorIds: string[],
): Promise<Map<string, PartnerScore>> {
  const map = new Map<string, PartnerScore>();
  const ids = [...new Set(investorIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data } = await snap(admin)
    .from("partner_score_snapshots")
    .select("investor_id, payload")
    .in("investor_id", ids);
  for (const row of (data ?? []) as Array<{ investor_id: string; payload: PartnerScore }>) {
    map.set(row.investor_id, row.payload);
  }

  // Live fallback for any investor without a cached snapshot.
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const computed = await Promise.all(
      missing.map(async (id) => [id, await loadPartnerScore(admin, id)] as const),
    );
    for (const [id, score] of computed) map.set(id, score);
  }
  return map;
}

/**
 * Recompute and upsert partner-score snapshots for all investors. Run from the
 * daily orchestration cron. Concurrency is chunked so we never fan out hundreds of
 * simultaneous query bursts. Returns the number of snapshots written.
 */
export async function refreshPartnerScoreSnapshots(
  admin: SupabaseClient<Database>,
  now: number = Date.now(),
): Promise<{ refreshed: number }> {
  const investorsRes = await admin.from("investor_profiles").select("profile_id");
  const ids = [
    ...new Set(
      ((investorsRes as { data: Array<{ profile_id: string | null }> | null }).data ?? [])
        .map((r) => r.profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return { refreshed: 0 };

  const computedAt = new Date(now).toISOString();
  type SnapshotRow = {
    investor_id: string;
    score: number | null;
    tier: string;
    status: string;
    sample_size: number;
    payload: PartnerScore;
    computed_at: string;
  };

  const rows: SnapshotRow[] = [];
  const CHUNK = 8; // ~8 investors × ~7 queries = ~56 concurrent reads per wave
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const chunkRows = await Promise.all(
      chunk.map(async (investorId): Promise<SnapshotRow> => {
        const score = await loadPartnerScore(admin, investorId, now);
        return {
          investor_id: investorId,
          score: score.score,
          tier: score.tier,
          status: score.status,
          sample_size: score.sampleSize,
          payload: score,
          computed_at: computedAt,
        };
      }),
    );
    rows.push(...chunkRows);
  }

  const { error } = await snap(admin)
    .from("partner_score_snapshots")
    .upsert(rows, { onConflict: "investor_id" });
  if (error) throw new Error(error.message);
  return { refreshed: rows.length };
}
