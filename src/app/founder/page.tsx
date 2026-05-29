import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/SectionHeader";
import { listCompanyDocuments } from "@/lib/data/documents";
import { founderPipeline } from "@/lib/mock-data";
import { CompanyPledgeSummaryBlock } from "@/components/CompanyPledgeSummary";
import {
  emptyCompanyPledgeSummary,
  getCompanyPledgeSummary,
  getFounderPledgeCompanyId,
} from "@/lib/data/investor-pledges";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function FounderDashboardPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const serviceSupabase = createServiceRoleClient();
  const { data: documents } = company ? await listCompanyDocuments(supabase, company.id) : { data: [] };
  const investorActivity = company ? await listFounderInvestorActivity(supabase, company.id) : null;

  let pledgeSummary = emptyCompanyPledgeSummary();
  if (company) {
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    pledgeSummary = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);
  }

  const pitchDeck = documents?.find((document) => document.document_type === "PITCH_DECK");
  const companyName = company?.company_name ?? "Your company";
  const documentStatus = pitchDeck ? "Pitch deck uploaded" : founderPipeline.documentStatus;

  return (
    <AppShell role="FOUNDER">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SectionHeader
          eyebrow="Founder dashboard"
          title={companyName}
          description="Track your company submission, diligence readiness, data room completion, and marketplace publication status."
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/founder/settings" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Company settings
          </Link>
          <Link
            href="/founder/onboarding"
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800"
          >
            Update company profile
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Company profile status"
          value={company?.status ?? founderPipeline.profileStatus}
          detail={company?.business_description ?? "Complete your company profile to improve readiness."}
        />
        <MetricCard label="Readiness score" value={`${founderPipeline.readinessScore}/100`} detail={founderPipeline.diligenceProgress} />
        <MetricCard label="Campaign status" value={founderPipeline.campaignStatus} detail="Admin approval required before investor visibility" />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Next actions</h2>
          <div className="mt-5 grid gap-3 text-sm text-slate-700">
            {founderPipeline.nextSteps.map((step) => (
              <div key={step} className="rounded-xl border border-slate-200 p-4 font-medium">
                {step}
              </div>
            ))}
          </div>
          <Link href="/founder/documents" className="mt-5 inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800">
            Upload pitch deck
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-950">Document upload status</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{documentStatus}</span>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {(documents ?? []).length > 0 ? (
              documents?.map((document) => (
                <div key={document.id} className="flex items-center justify-between py-4 text-sm">
                  <span className="font-medium text-slate-800">{document.file_name ?? document.document_type}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{document.status ?? "uploaded"}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-600">No documents uploaded yet.</p>
            )}
          </div>
        </div>
      </section>

      {company ? (
        <section className="mt-8">
          <p className="mb-3 text-sm text-slate-600">
            Non-binding pledge totals from marketplace investors. Pledges are not legally committed investment.
          </p>
          <CompanyPledgeSummaryBlock summary={pledgeSummary} />
        </section>
      ) : null}

      {company && investorActivity ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Investor activity on your listing</h2>
          <p className="mt-2 text-sm text-slate-600">
            Read-only summary of investor interest. Founders cannot perform investor actions on their own company.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ["Expressed interest", investorActivity.interests],
              ["Intro requests", investorActivity.introRequests],
              ["Saved deals", investorActivity.savedDeals],
            ].map(([title, rows]) => (
              <div key={title as string} className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{title as string}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{(rows as unknown[]).length}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
