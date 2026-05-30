import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { listCompanyDocuments } from "@/lib/data/documents";
import { founderPipeline } from "@/lib/mock-data";
import { formatPledgeTotal, getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
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

  let pledgeSummary = { totalPledged: 0, investorCount: 0, currency: "USD" };
  if (company) {
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    pledgeSummary = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);
  }

  const companyName = company?.company_name ?? "Your company";
  const pitchDeck = documents?.find((document) => document.document_type === "PITCH_DECK");
  const documentStatus = pitchDeck ? "Pitch deck uploaded" : founderPipeline.documentStatus;
  const investorActivityTotal =
    (investorActivity?.interests.length ?? 0) +
    (investorActivity?.introRequests.length ?? 0) +
    (investorActivity?.savedDeals.length ?? 0);
  const raiseProgress = company?.is_published ? "Published" : founderPipeline.campaignStatus;

  return (
    <AppShell
      role="FOUNDER"
      workspace="founder"
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Founder Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{companyName}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Track readiness, capital raise progress, investor engagement, and marketplace publication.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/founder/settings"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            Company settings
          </Link>
          <Link
            href="/founder/onboarding"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
          >
            Update profile
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Readiness Score"
          value={`${founderPipeline.readinessScore}/100`}
          detail={founderPipeline.diligenceProgress}
          accent="indigo"
        />
        <MetricCard
          label="Raise Progress"
          value={raiseProgress}
          detail={company?.status ?? founderPipeline.profileStatus}
          accent="violet"
        />
        <MetricCard
          label="Indicative Interest"
          value={formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
          detail={`From ${pledgeSummary.investorCount} ${pledgeSummary.investorCount === 1 ? "investor" : "investors"}`}
          accent="blue"
        />
        <MetricCard
          label="Investor Activity"
          value={String(investorActivityTotal)}
          detail="Interest, intros, and saved deals"
          accent="slate"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Tasks Due" subtitle="Priority actions to improve readiness">
          <div className="grid gap-3">
            {founderPipeline.nextSteps.map((step) => (
              <div key={step} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
                {step}
              </div>
            ))}
          </div>
          <Link
            href="/founder/documents"
            className="mt-4 inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900"
          >
            Upload pitch deck
          </Link>
        </WorkspacePanel>

        <WorkspacePanel title="Capital Raise Overview" subtitle="Non-binding marketplace interest">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100">
              <p className="text-sm font-medium text-indigo-700">Total pledged</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-sm font-medium text-slate-600">Funding target</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {company?.funding_amount ? formatPledgeTotal(Number(company.funding_amount)) : "TBD"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Pledges are indicative and not legally committed investment.
          </p>
        </WorkspacePanel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Investor Pipeline" subtitle="Read-only activity on your listing">
          {investorActivity ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Expressed interest", investorActivity.interests.length],
                ["Intro requests", investorActivity.introRequests.length],
                ["Saved deals", investorActivity.savedDeals.length],
              ].map(([title, count]) => (
                <div key={title as string} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-600">{title as string}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{count as number}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Investor activity will appear once your company is linked.</p>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          title="Recent Activity"
          subtitle="Documents and data room status"
          action={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{documentStatus}</span>
          }
        >
          <div className="divide-y divide-slate-100">
            {(documents ?? []).length > 0 ? (
              documents?.slice(0, 5).map((document) => (
                <div key={document.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-slate-800">{document.file_name ?? document.document_type}</span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {document.status ?? "uploaded"}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-3 text-sm text-slate-600">No documents uploaded yet.</p>
            )}
          </div>
        </WorkspacePanel>
      </section>
    </AppShell>
  );
}
