import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderSpvStatusPanel } from "@/components/FounderSpvStatusPanel";
import { formatError } from "@/lib/errors/format-error";
import { listFounderChecklistSummary } from "@/lib/spv/checklist";
import { listFounderClosingSummaries } from "@/lib/spv/closing-reviews";
import { listFounderPackageSummaries } from "@/lib/spv/document-packages";
import { listFounderSpvSummary } from "@/lib/spv/spv-workflow";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import type { Company } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function FounderSpvsPage() {
  const profile = await requireRole(["founder"]);

  let company: Company | null = null;
  let companyError: string | null = null;

  let spvOpportunities: Awaited<ReturnType<typeof listFounderSpvSummary>>["opportunities"] = [];
  let spvParticipations: Awaited<ReturnType<typeof listFounderSpvSummary>>["participations"] = [];
  let spvChecklistSummaryBySpv: Awaited<ReturnType<typeof listFounderChecklistSummary>>["data"] = {};
  let spvPackageSummaryBySpv: Awaited<ReturnType<typeof listFounderPackageSummaries>>["data"] = {};
  let spvClosingSummaryBySpv: Awaited<ReturnType<typeof listFounderClosingSummaries>>["data"] = {};
  let spvExecutionSummaryBySpv: Record<
    string,
    { executionPct: number; signerPct: number; nextStep: string }
  > = {};

  try {
    company = await ensureFounderCompanyForUser(profile);
  } catch (error) {
    companyError = formatError(error);
  }

  if (company) {
    try {
      const supabase = await createServerSupabaseClient();
      const spvSummary = await listFounderSpvSummary(supabase, company.id);
      spvOpportunities = spvSummary.opportunities;
      spvParticipations = spvSummary.participations;

      const [checklistResult, packageResult, closingResult] = await Promise.all([
        listFounderChecklistSummary(
          supabase,
          spvOpportunities.map((spv) => spv.id),
        ),
        listFounderPackageSummaries(
          supabase,
          spvOpportunities.map((spv) => spv.id),
        ),
        listFounderClosingSummaries(
          supabase,
          spvOpportunities.map((spv) => spv.id),
        ),
      ]);

      spvChecklistSummaryBySpv = checklistResult.data ?? {};
      spvPackageSummaryBySpv = packageResult.data ?? {};
      spvClosingSummaryBySpv = closingResult.data ?? {};

      for (const spv of spvOpportunities) {
        const pkg = spvPackageSummaryBySpv[spv.id];
        const partsForSpv = spvParticipations.filter((p) => p.spv_opportunity_id === spv.id);
        const activeCount = partsForSpv.filter(
          (p) => !["declined", "canceled"].includes(p.status),
        ).length;
        const readyCount = spv.investors_document_ready_count ?? 0;
        spvExecutionSummaryBySpv[spv.id] = {
          executionPct: spv.package_readiness_pct ?? pkg?.readinessPct ?? 0,
          signerPct: activeCount > 0 ? Math.round((readyCount / activeCount) * 100) : 0,
          nextStep:
            "Complete operational packages and investor requirements — DocuSign not connected (readiness only)",
        };
      }
    } catch {
      spvOpportunities = [];
      spvParticipations = [];
      spvChecklistSummaryBySpv = {};
      spvPackageSummaryBySpv = {};
      spvClosingSummaryBySpv = {};
      spvExecutionSummaryBySpv = {};
    }
  }

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="capital_raise">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Founder Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">SPVs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Track your SPV opportunities, investor participation, and closing readiness.
          </p>
        </div>

        {companyError ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Company load failed: {companyError}
          </div>
        ) : null}

        {!company ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No company profile found. Complete onboarding to access SPV features.
          </div>
        ) : (
          <FounderSpvStatusPanel
            opportunities={spvOpportunities}
            participations={spvParticipations}
            checklistSummaryBySpv={spvChecklistSummaryBySpv ?? {}}
            packageSummaryBySpv={spvPackageSummaryBySpv ?? {}}
            closingSummaryBySpv={spvClosingSummaryBySpv ?? {}}
            executionSummaryBySpv={spvExecutionSummaryBySpv}
          />
        )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
