import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildReadinessBoard,
  latestScorePerCompany,
  type ReadinessBoard,
} from "@/lib/marketplace/readiness-board";

type ScoreRow = {
  company_id: string;
  created_at: string;
  total_score: number | null;
  effective_score: number | null;
  companies: { is_sample: boolean | null } | null;
};

/**
 * Real founder readiness aggregates for the public Deals page. Sample accounts
 * are excluded. Returns null on any failure so the page can hide the section
 * instead of showing a made up number.
 */
export async function getReadinessBoard(): Promise<ReadinessBoard | null> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("company_readiness_scores")
      .select("company_id, created_at, total_score, effective_score, companies!inner(is_sample)")
      .eq("companies.is_sample", false)
      .order("created_at", { ascending: false });
    if (error || !data) return null;

    const rows = (data as unknown as ScoreRow[]).map((r) => ({
      company_id: r.company_id,
      created_at: r.created_at,
      score: r.effective_score ?? r.total_score,
    }));
    return buildReadinessBoard(latestScorePerCompany(rows));
  } catch {
    return null;
  }
}
