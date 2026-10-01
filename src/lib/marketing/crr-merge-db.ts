import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeCrrChange, type CrrChange, type CrrScoreRow } from "./crr-merge";

/**
 * Look up a recipient's CRR change by email: profile → companies they found →
 * company_readiness_scores history. Three small indexed reads, run only for
 * templates that use the CRR tokens. Any failure returns null (send is skipped).
 */
export async function loadCrrChangeForEmail(email: string): Promise<CrrChange | null> {
  try {
    const db = createServiceRoleClient();
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .ilike("email", email.trim())
      .limit(1)
      .maybeSingle();
    const founderId = (profile as { id: string } | null)?.id;
    if (!founderId) return null;

    const { data: companies } = await db.from("companies").select("id").eq("founder_id", founderId);
    const ids = ((companies ?? []) as { id: string }[]).map((c) => c.id);
    if (ids.length === 0) return null;

    const { data: scores } = await db
      .from("company_readiness_scores")
      .select("company_id, effective_score, created_at")
      .in("company_id", ids)
      .order("created_at", { ascending: true });
    return computeCrrChange((scores ?? []) as CrrScoreRow[]);
  } catch {
    return null;
  }
}
