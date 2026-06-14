import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderSpvStatusPanel } from "@/components/FounderSpvStatusPanel";
import { PageHeader } from "@/components/ui/PageHeader";
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
        <PageHeader
          eyebrow="Founder workspace"
          title="SPVs"
          description="Special Purpose Vehicles created by CapitalOS admin to pool investor capital."
        />

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
          <>
            {/* Stat boxes */}
            <section className="mb-6 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Active SPVs",
                  value: spvOpportunities.filter((s) => !["closed", "canceled"].includes(s.status)).length,
                },
                {
                  label: "Total target",
                  value: spvOpportunities.length > 0
                    ? `$${(spvOpportunities.reduce((sum, s) => sum + (s.target_amount ?? 0), 0) / 1000).toFixed(0)}K`
                    : "—",
                },
                {
                  label: "Investors across SPVs",
                  value: spvParticipations.filter((p) => !["declined", "canceled"].includes(p.status)).length,
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{stat.value}</p>
                </div>
              ))}
            </section>

            {/* Explainer */}
            <section className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
              <h2 className="text-sm font-semibold text-indigo-900">What is an SPV?</h2>
              <p className="mt-1.5 text-xs leading-5 text-indigo-700">
                A Special Purpose Vehicle (SPV) is a legal entity created by CapitalOS admin to pool multiple investors
                into a single line on your cap table. When an SPV is formed for your company, you&apos;ll see it here
                with the total capital, investor count, and closing status.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/founder/capital-raise"
                  className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-400"
                >
                  → View capital raise
                </Link>
                <Link
                  href="/founder/learning"
                  className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-400"
                >
                  → Learn about SPVs
                </Link>
              </div>
            </section>

            <FounderSpvStatusPanel
              opportunities={spvOpportunities}
              participations={spvParticipations}
              checklistSummaryBySpv={spvChecklistSummaryBySpv ?? {}}
              packageSummaryBySpv={spvPackageSummaryBySpv ?? {}}
              closingSummaryBySpv={spvClosingSummaryBySpv ?? {}}
              executionSummaryBySpv={spvExecutionSummaryBySpv}
            />
          </>
        )}
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
