import { buildDocumentChecklist } from "@/lib/data/founder-readiness";
import { getPitchDeckDocumentId } from "@/lib/data/investor-actions";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { getCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import {
  getMarketplaceListingByCompanyId,
  type MarketplaceListing,
} from "@/lib/data/marketplace";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { DocumentRecord } from "@/lib/supabase/types";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

export type InvestorCompanyReportSnapshot = {
  listing: MarketplaceListing;
  overview: {
    industry: string | null;
    stage: string | null;
    location: string | null;
    publishedAt: string | null;
    shortSummary: string | null;
  };
  capitalRaise: {
    fundingTarget: string | null;
    minimumInvestment: string | null;
    useOfFunds: string | null;
  };
  readiness: {
    readinessScore: number | null;
    readinessHistory: Array<{ score: number | null; created_at: string }>;
    onboardingProgressPercent: number;
    onboardingCompletedAt: string | null;
    currentMilestone: string | null;
  };
  documents: {
    uploadedCount: number;
    pitchDeckPresent: boolean;
    approvedCount: number;
    checklist: ReturnType<typeof buildDocumentChecklist>;
    missingRequiredLabels: string[];
  };
  investorSignals: {
    expressedInterestCount: number;
    indicativePledgeTotal: number;
    pledgeCurrency: string;
    investorCount: number;
    introRequestCount: number;
    messageThreadCount: number;
    meetingsScheduledCount: number;
  };
  riskFactors: {
    missingItems: string[];
    riskFlagCount: number;
    publicRiskDisclosures: string | null;
  };
  diligenceSummary: {
    executiveSummary: string | null;
    readinessScore: number | null;
    generatedAt: string | null;
  };
  investableReadiness: {
    scoreId: string | null;
    totalScore: number | null;
    effectiveScore: number | null;
    isOverridden: boolean;
    factorScores: Record<FactorKey, FactorScore> | null;
    scoredAt: string | null;
    scoreHistory: Array<{ score: number; scoredAt: string }>;
    platformAvg: number | null;
    percentile: number | null;
  };
  learning: {
    modulesCompleted: number;
    modulesInProgress: number;
  };
  ctas: {
    pitchDeckDocumentId: string | null;
    dealSlug: string;
  };
};

function resolveOnboardingMilestone(
  stepState: Record<string, unknown> | null | undefined,
): string | null {
  if (!stepState || typeof stepState !== "object") {
    return null;
  }
  if (typeof stepState.current_step === "string") {
    return stepState.current_step;
  }
  const completed = Object.entries(stepState)
    .filter(([key, value]) => key !== "current_step" && value === true)
    .map(([key]) => key);
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

export async function loadInvestorCompanyReport(
  companyId: string,
  options?: { investorId?: string; logView?: boolean },
): Promise<InvestorCompanyReportSnapshot | null> {
  const admin = createServiceRoleClient();
  const listing = await getMarketplaceListingByCompanyId(admin, companyId);

  if (!listing) {
    return null;
  }

  const [
    companyRes,
    documentsRes,
    diligenceRes,
    pledgeSummary,
    interestsCount,
    introCount,
    threadsCount,
    meetingsCount,
    learningRes,
    pitchDeckDocumentId,
    readinessScoreRes,
  ] = await Promise.all([
    admin
      .from("companies")
      .select(
        "onboarding_progress_percent, onboarding_completed_at, onboarding_step_state",
      )
      .eq("id", companyId)
      .single(),
    admin
      .from("documents")
      .select("id, document_type, status, is_approved, created_at")
      .eq("company_id", companyId),
    admin
      .from("diligence_reports")
      .select(
        "readiness_score, executive_summary, missing_documents, risk_flags, created_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5),
    getCompanyPledgeSummary(admin, companyId),
    admin
      .from("investor_interests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    admin
      .from("intro_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    admin
      .from("message_threads")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    admin
      .from("thread_meetings")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "scheduled"),
    admin
      .from("learning_progress")
      .select("status")
      .eq("company_id", companyId),
    getPitchDeckDocumentId(admin, companyId),
    admin
      .from("company_readiness_scores")
      .select("id, total_score, effective_score, override_score, factor_scores, scored_by, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const company = companyRes.data;
  const documents = (documentsRes.data ?? []) as DocumentRecord[];
  const diligenceReports = diligenceRes.data ?? [];
  const latestDiligence = diligenceReports[0];
  const readinessScores = readinessScoreRes.data ?? [];
  const latestReadinessScore = readinessScores[0] ?? null;

  // Platform avg + percentile (across all scored companies)
  const { data: allScores } = await admin
    .from("company_readiness_scores")
    .select("company_id, total_score, created_at")
    .order("created_at", { ascending: false });

  // Deduplicate — keep only the latest score per company
  const latestByCompany = new Map<string, number>();
  for (const row of allScores ?? []) {
    if (!latestByCompany.has(row.company_id)) {
      latestByCompany.set(row.company_id, row.total_score);
    }
  }
  const allLatestScores = Array.from(latestByCompany.values());
  const platformAvg =
    allLatestScores.length > 0
      ? Math.round(allLatestScores.reduce((a, b) => a + b, 0) / allLatestScores.length)
      : null;
  const thisScore = latestReadinessScore?.effective_score ?? latestReadinessScore?.total_score ?? null;
  const percentile =
    thisScore !== null && allLatestScores.length > 0
      ? Math.round(
          (allLatestScores.filter((s) => s <= thisScore).length / allLatestScores.length) * 100,
        )
      : null;

  const checklist = buildDocumentChecklist(documents);
  const missingRequiredLabels = checklist
    .filter((item) => item.status === "missing")
    .map((item) => item.label);

  const riskFlags = Array.isArray(latestDiligence?.risk_flags)
    ? (latestDiligence.risk_flags as unknown[])
    : [];
  const missingFromReport = Array.isArray(latestDiligence?.missing_documents)
    ? (latestDiligence.missing_documents as unknown[]).map(String)
    : [];

  const learningRows = learningRes.data ?? [];
  const modulesCompleted = learningRows.filter((row) => row.status === "completed").length;
  const modulesInProgress = learningRows.filter(
    (row) => row.status === "in_progress" || row.status === "started",
  ).length;

  if (options?.logView && options.investorId) {
    void recordInvestorCrmActivity(admin, {
      investorId: options.investorId,
      companyId,
      activityType: "report_viewed",
      metadata: { source: "investor_company_report" },
    });
  }

  return {
    listing,
    overview: {
      industry: listing.industry,
      stage: listing.stage,
      location: listing.location,
      publishedAt: listing.publishedAt,
      shortSummary: listing.shortSummary,
    },
    capitalRaise: {
      fundingTarget: listing.fundingTarget,
      minimumInvestment: listing.minimumInvestment,
      useOfFunds: listing.useOfFunds,
    },
    readiness: {
      readinessScore: latestDiligence?.readiness_score ?? null,
      readinessHistory: diligenceReports.map((row) => ({
        score: row.readiness_score,
        created_at: row.created_at,
      })),
      onboardingProgressPercent: company?.onboarding_progress_percent ?? 0,
      onboardingCompletedAt: company?.onboarding_completed_at ?? null,
      currentMilestone: resolveOnboardingMilestone(
        company?.onboarding_step_state as Record<string, unknown> | null,
      ),
    },
    documents: {
      uploadedCount: documents.length,
      pitchDeckPresent: checklist.some(
        (item) => item.code === "PITCH_DECK" && item.status !== "missing",
      ),
      approvedCount: documents.filter((doc) => doc.is_approved).length,
      checklist,
      missingRequiredLabels,
    },
    investorSignals: {
      expressedInterestCount: interestsCount.count ?? 0,
      indicativePledgeTotal: pledgeSummary.totalPledged,
      pledgeCurrency: pledgeSummary.currency,
      investorCount: pledgeSummary.investorCount,
      introRequestCount: introCount.count ?? 0,
      messageThreadCount: threadsCount.count ?? 0,
      meetingsScheduledCount: meetingsCount.count ?? 0,
    },
    riskFactors: {
      missingItems: [...new Set([...missingRequiredLabels, ...missingFromReport])],
      riskFlagCount: riskFlags.length,
      publicRiskDisclosures: listing.riskDisclosures,
    },
    diligenceSummary: {
      executiveSummary:
        latestDiligence?.executive_summary ?? listing.diligenceSummary ?? listing.overview,
      readinessScore: latestDiligence?.readiness_score ?? null,
      generatedAt: latestDiligence?.created_at ?? null,
    },
    investableReadiness: {
      scoreId: latestReadinessScore?.id ?? null,
      totalScore: latestReadinessScore?.total_score ?? null,
      effectiveScore: latestReadinessScore?.effective_score ?? null,
      isOverridden: latestReadinessScore?.override_score != null,
      factorScores: (latestReadinessScore?.factor_scores as Record<FactorKey, FactorScore> | null) ?? null,
      scoredAt: latestReadinessScore?.created_at ?? null,
      scoreHistory: readinessScores.map((r) => ({
        score: r.effective_score ?? r.total_score,
        scoredAt: r.created_at,
      })),
      platformAvg,
      percentile,
    },
    learning: {
      modulesCompleted,
      modulesInProgress,
    },
    ctas: {
      pitchDeckDocumentId,
      dealSlug: listing.slug,
    },
  };
}
