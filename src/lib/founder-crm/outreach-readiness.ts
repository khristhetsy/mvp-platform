import { listCompanyDocuments } from "@/lib/data/documents";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Company } from "@/lib/supabase/types";

const ONBOARDING_THRESHOLD = 60;
/** Minimum AI readiness score required to unlock investor outreach */
const READINESS_SCORE_THRESHOLD = 65;

export type OutreachReadinessResult = {
  allowed: boolean;
  subscriptionAllowed: boolean;
  subscriptionReason: string | null;
  requirements: Array<{ key: string; label: string; met: boolean; href?: string }>;
  criticalRemediationCount: number;
  readinessScore: number | null;
  learningRecommendations: string[];
};

export async function evaluateFounderOutreachReadiness(
  company: Company,
  founderId: string,
): Promise<OutreachReadinessResult> {
  const access = await getFounderFeatureAccess("investor_access");
  const supabase = await createServerSupabaseClient();
  // Service role needed to read company_readiness_scores (no founder RLS)
  const adminClient = createServiceRoleClient();

  const [{ data: documents }, { data: diligenceReport }, { data: latestReadinessScore }] =
    await Promise.all([
      listCompanyDocuments(supabase, company.id),
      getLatestDiligenceReport(supabase, company.id),
      adminClient
        .from("company_readiness_scores")
        .select("effective_score, outreach_unlocked")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const onboarding = computeFounderOnboardingProgress({
    company,
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
    storedStepState: company.onboarding_step_state,
  });

  const pitchDeck = (documents ?? []).some((doc) => doc.document_type === "PITCH_DECK");
  const businessPlan = (documents ?? []).some((doc) => doc.document_type === "BUSINESS_PLAN");
  const descriptionOk = (company.business_description?.trim().length ?? 0) >= 50;
  const raiseOk = company.funding_amount != null && Number(company.funding_amount) > 0;

  // AI readiness score gate — uses effective_score (override takes precedence)
  const aiScore = latestReadinessScore?.effective_score ?? null;
  const aiScoreMet = aiScore !== null && aiScore >= READINESS_SCORE_THRESHOLD;

  const { count: criticalRemediationCount } = await supabase
    .from("founder_remediation_tasks")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("founder_id", founderId)
    .eq("priority", "high")
    .in("status", ["open", "in_progress"]);

  const requirements = [
    {
      key: "subscription",
      label: "Founder Professional plan or active trial",
      met: access.allowed,
      href: "/billing",
    },
    {
      key: "onboarding",
      label: `Onboarding progress at least ${ONBOARDING_THRESHOLD}%`,
      met: onboarding.percent >= ONBOARDING_THRESHOLD,
      href: "/founder/onboarding",
    },
    {
      key: "pitch_deck",
      label: "Pitch deck uploaded",
      met: pitchDeck,
      href: "/founder/documents",
    },
    {
      key: "business_plan",
      label: "Business plan uploaded",
      met: businessPlan,
      href: "/founder/documents",
    },
    {
      key: "description",
      label: "Company description completed",
      met: descriptionOk,
      href: "/founder/settings",
    },
    {
      key: "raise",
      label: "Funding target set",
      met: raiseOk,
      href: "/founder/settings",
    },
    {
      key: "remediation",
      label: "No open high-priority remediation blockers",
      met: (criticalRemediationCount ?? 0) === 0,
      href: "/founder/readiness",
    },
    {
      key: "ai_readiness_score",
      label: `Investable readiness score ≥ ${READINESS_SCORE_THRESHOLD}`,
      met: aiScoreMet,
      href: "/founder/readiness",
    },
  ];

  const metAll = access.allowed && requirements.every((row) => row.met);

  const learningRecommendations: string[] = [];
  if (!pitchDeck) {
    learningRecommendations.push("Upload your pitch deck in Documents.");
  }
  if (!businessPlan) {
    learningRecommendations.push("Upload your business plan in Documents.");
  }
  if (!descriptionOk || !raiseOk) {
    learningRecommendations.push("Complete company profile and capital raise details in Settings.");
  }
  if ((criticalRemediationCount ?? 0) > 0) {
    learningRecommendations.push("Resolve high-priority remediation tasks before outreach.");
  }
  if (onboarding.percent < ONBOARDING_THRESHOLD) {
    learningRecommendations.push("Finish onboarding milestones to unlock outreach.");
  }
  if (!aiScoreMet) {
    if (aiScore === null) {
      learningRecommendations.push(
        "An investable readiness score is required before investor outreach. Upload your key documents to trigger scoring.",
      );
    } else {
      learningRecommendations.push(
        `Your investable readiness score (${aiScore}) is below the ${READINESS_SCORE_THRESHOLD}-point threshold. Strengthen your documents to improve your score.`,
      );
    }
  }

  return {
    allowed: metAll,
    subscriptionAllowed: access.allowed,
    subscriptionReason: access.reason,
    requirements,
    criticalRemediationCount: criticalRemediationCount ?? 0,
    readinessScore: aiScore ?? diligenceReport?.readiness_score ?? null,
    learningRecommendations,
  };
}
