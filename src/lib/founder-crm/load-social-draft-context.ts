import { listCompanyDocuments } from "@/lib/data/documents";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { generateSocialOutreachDraft } from "@/lib/founder-crm/social-draft-templates";
import type { SocialDraftContext } from "@/lib/founder-crm/social-draft-templates";
import type { SocialDraftPlatform, SocialDraftType } from "@/lib/founder-crm/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/supabase/types";

export async function buildSocialDraftContext(
  company: Company,
  founderId: string,
  platform: SocialDraftPlatform,
  campaignId?: string | null,
): Promise<SocialDraftContext> {
  const supabase = await createServerSupabaseClient();

  const [{ data: documents }, { data: diligenceReport }, remediation, campaign] = await Promise.all([
    listCompanyDocuments(supabase, company.id),
    getLatestDiligenceReport(supabase, company.id),
    supabase
      .from("founder_remediation_tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("founder_id", founderId)
      .in("status", ["open", "in_progress"]),
    campaignId
      ? supabase.from("outreach_campaigns").select("name").eq("id", campaignId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const onboarding = computeFounderOnboardingProgress({
    company,
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
    storedStepState: company.onboarding_step_state,
  });

  const isPublished =
    company.review_status === "approved" &&
    company.is_published &&
    company.marketplace_visible &&
    company.published_at != null;

  return {
    company,
    readinessScore: diligenceReport?.readiness_score ?? null,
    onboardingPercent: onboarding.percent,
    isPublished,
    remediationOpenCount: remediation.count ?? 0,
    campaignName: campaign.data?.name ?? null,
    platform,
  };
}

export async function previewSocialOutreachDraft(input: {
  company: Company;
  founderId: string;
  draftType: SocialDraftType;
  platform: SocialDraftPlatform;
  campaignId?: string | null;
}) {
  const context = await buildSocialDraftContext(
    input.company,
    input.founderId,
    input.platform,
    input.campaignId,
  );
  return generateSocialOutreachDraft({ draftType: input.draftType, context });
}
