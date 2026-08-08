import type { SupabaseClient } from "@supabase/supabase-js";
import type { PitchDeckAnalysis } from "@/app/api/founder/pitch-deck-analyze/route";

// Persist / load the latest pitch-deck AI analysis for a company. Callers pass a
// service-role client after verifying the company belongs to the founder.
function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export async function savePitchDeckAnalysis(
  admin: unknown,
  companyId: string,
  analysis: PitchDeckAnalysis,
): Promise<string> {
  const updatedAt = new Date().toISOString();
  await loose(admin)
    .from("pitch_deck_analyses")
    .upsert({ company_id: companyId, analysis, updated_at: updatedAt }, { onConflict: "company_id" });
  return updatedAt;
}

export async function getPitchDeckAnalysis(
  admin: unknown,
  companyId: string,
): Promise<{ analysis: PitchDeckAnalysis; updatedAt: string } | null> {
  const { data } = await loose(admin)
    .from("pitch_deck_analyses")
    .select("analysis, updated_at")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { analysis: PitchDeckAnalysis; updated_at: string };
  return { analysis: row.analysis, updatedAt: row.updated_at };
}
