import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { crrFor } from "@/lib/crr/crr-for";

/**
 * The Capital Readiness Rating for a company, resolved from the founder who
 * owns it — used by the founder preview and the public one-pager at /f/[slug].
 *
 * This used to compute its own composite (0.6 × a document-type count + 0.3 ×
 * profile completeness + two 5-point milestones). That number never touched a
 * factor, a dimension or a weight, so an investor reading the one-pager saw a
 * different score from the one on the company report. Both now read the engine.
 *
 * It is NOT a rating of the securities, and not investment advice.
 */
export async function loadInvestableScore(
  supabase: SupabaseClient<Database>,
  founderId: string,
): Promise<number | null> {
  if (!founderId) return null;
  const { data } = await supabase
    .from("companies").select("id").eq("founder_id", founderId).maybeSingle();
  const companyId = (data as { id?: string } | null)?.id ?? null;
  if (!companyId) return null;
  return (await crrFor(companyId)).score;
}
