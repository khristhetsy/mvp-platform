import { listCompanyDocuments } from "@/lib/data/documents";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { buildCompanyOnboardingSyncUpdate } from "@/lib/onboarding/sync-progress";
import {
  computeFounderOnboardingProgress,
  type FounderOnboardingProgress,
} from "@/lib/onboarding/progress";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Company, DocumentRecord, Profile } from "@/lib/supabase/types";

export type FounderOnboardingPageData = {
  company: Company;
  documents: DocumentRecord[];
  progress: FounderOnboardingProgress;
};

export async function loadFounderOnboardingPageData(profile: Profile): Promise<FounderOnboardingPageData | null> {
  const company = await ensureFounderCompanyForUser(profile);

  if (!company) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data: documents } = await listCompanyDocuments(supabase, company.id);
  const { data: diligenceReport } = await getLatestDiligenceReport(supabase, company.id);

  const progress = computeFounderOnboardingProgress({
    company,
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
    storedStepState: company.onboarding_step_state,
  });

  const sync = buildCompanyOnboardingSyncUpdate({
    company,
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
  });

  if (
    sync.onboarding_progress_percent !== (company.onboarding_progress_percent ?? 0) ||
    sync.onboarding_completed_at !== (company.onboarding_completed_at ?? null)
  ) {
    const { data: synced } = await supabase
      .from("companies")
      .update({
        onboarding_progress_percent: sync.onboarding_progress_percent,
        onboarding_step_state: sync.onboarding_step_state,
        onboarding_completed_at: sync.onboarding_completed_at,
      })
      .eq("id", company.id)
      .select("*")
      .single();

    if (synced) {
      return {
        company: synced as Company,
        documents: documents ?? [],
        progress: sync.progress,
      };
    }
  }

  return {
    company,
    documents: documents ?? [],
    progress,
  };
}
