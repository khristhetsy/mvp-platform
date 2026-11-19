import "server-only";

/**
 * A company's latest Capital Readiness Rating, for the per-plan minimum CRR gate
 * on automated outreach (Admin, Feature controls, Automated outreach limits).
 *
 * Takes the caller's service-role client so a pass over many campaigns reuses one
 * connection. Returns null when the company has never been scored, which the
 * callers treat as "below any threshold".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function latestCompanyReadiness(db: Db, companyId: string): Promise<number | null> {
  try {
    const { data } = await db
      .from("company_readiness_scores")
      .select("total_score")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const score = (data as { total_score?: number | null } | null)?.total_score;
    return typeof score === "number" ? score : null;
  } catch {
    // A read failure must not silently open the gate: callers treat null as below.
    return null;
  }
}
