// What the Capital Readiness scorer and the investor one-pager can read from a
// founder's in-platform business plan. Without this the scorer only saw uploaded
// PDFs, so a plan completed by hand never moved the score or filled "Raising".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type BusinessPlanInputs = {
  /** raiseAmount from the plan's assumptions, when it is a positive number. */
  raiseAmount: number | null;
  /** All section text joined, capped so it cannot swamp the document summaries. */
  summary: string | null;
};

const SUMMARY_CAP = 6000;

function sectionText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "content" in value) {
    const content = (value as { content?: unknown }).content;
    return typeof content === "string" ? content : "";
  }
  return "";
}

export async function loadBusinessPlanInputs(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<BusinessPlanInputs> {
  const { data } = await (supabase as unknown as SupabaseClient)
    .from("business_plans")
    .select("sections, assumptions, exec_summary, status")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return { raiseAmount: null, summary: null };

  const row = data as {
    sections: Record<string, unknown> | null;
    assumptions: Record<string, unknown> | null;
    exec_summary: string | null;
    status: string | null;
  };

  const raise = Number(row.assumptions?.raiseAmount);
  const raiseAmount = Number.isFinite(raise) && raise > 0 ? raise : null;

  const parts = [
    row.exec_summary ?? "",
    ...Object.values(row.sections ?? {}).map(sectionText),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const summary = parts.length ? parts.join("\n\n").slice(0, SUMMARY_CAP) : null;

  return { raiseAmount, summary };
}
