import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getCompanyPledgeSummaries } from "@/lib/data/investor-pledges";
import { loadMarketplaceCompanyMatchProfiles } from "@/lib/matching/load-matching-data";
import type { MetricSnapshot } from "@/lib/investor/metric-trends";

/** company_metric_snapshots is not in generated types yet — cast through a raw client. */
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type SnapshotRow = {
  company_id: string;
  captured_at: string;
  readiness_score: number | null;
  total_indicated: number | string | null;
};

/**
 * Capture one snapshot per marketplace company for today (UTC). Idempotent per
 * day via the (company_id, capture_date) unique index. Intended to run on the
 * orchestration cron. Requires a service-role client.
 */
export async function captureCompanyMetricSnapshots(
  admin: SupabaseClient<Database>,
): Promise<{ captured: number }> {
  const profiles = await loadMarketplaceCompanyMatchProfiles(admin);
  if (profiles.length === 0) return { captured: 0 };

  const companyIds = profiles.map((p) => p.id);
  const pledges = await getCompanyPledgeSummaries(admin, companyIds);

  const now = new Date();
  const captureDate = now.toISOString().slice(0, 10); // UTC YYYY-MM-DD
  const capturedAt = now.toISOString();

  const rows = profiles.map((p) => ({
    company_id: p.id,
    capture_date: captureDate,
    captured_at: capturedAt,
    readiness_score: p.readinessScore,
    total_indicated: pledges[p.id]?.totalPledged ?? 0,
  }));

  const { error } = await raw(admin)
    .from("company_metric_snapshots")
    .upsert(rows, { onConflict: "company_id,capture_date" });

  if (error) throw new Error(error.message);
  return { captured: rows.length };
}

/** Recent snapshot history per company (oldest→newest), for trend + filling-fast. */
export async function getCompanyMetricHistory(
  supabase: SupabaseClient<Database>,
  companyIds: string[],
  sinceDays = 30,
): Promise<Map<string, MetricSnapshot[]>> {
  const history = new Map<string, MetricSnapshot[]>();
  if (companyIds.length === 0) return history;

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await raw(supabase)
    .from("company_metric_snapshots")
    .select("company_id, captured_at, readiness_score, total_indicated")
    .in("company_id", companyIds)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });

  for (const row of (data ?? []) as SnapshotRow[]) {
    const list = history.get(row.company_id) ?? [];
    list.push({
      capturedAt: row.captured_at,
      readinessScore: row.readiness_score,
      totalIndicated: Number(row.total_indicated ?? 0),
    });
    history.set(row.company_id, list);
  }

  return history;
}
