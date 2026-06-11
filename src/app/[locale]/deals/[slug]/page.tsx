import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CapitalReadyBadge } from "@/components/CapitalReadyBadge";
import { CompanyPledgeSummaryBlock } from "@/components/CompanyPledgeSummary";
import { ComplianceNotice } from "@/components/ComplianceNotice";
import { InvestorDealActions } from "@/components/InvestorDealActions";
import { getPitchDeckDocumentId } from "@/lib/data/investor-actions";
import { getCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { getMarketplaceListingBySlug } from "@/lib/data/marketplace";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { toShellRole, viewerRoleFromProfile } from "@/lib/supabase/roles";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: Readonly<{
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();
  const deal = await getMarketplaceListingBySlug(supabase, slug);

  if (!deal) {
    notFound();
  }

  const profile = await getCurrentUserProfile();
  const viewerRole = viewerRoleFromProfile(profile?.role ?? null);
  const shellRole = toShellRole(profile?.role);
  const isOwnCompany = profile?.id === deal.founderId;
  const [pitchDeckDocumentId, pledgeSummary] = await Promise.all([
    getPitchDeckDocumentId(supabase, deal.id),
    getCompanyPledgeSummary(supabase, deal.id),
  ]);

  const sections = [
    ["Company overview", deal.overview],
    ["Problem", deal.problem],
    ["Solution", deal.solution],
    ["Market opportunity", deal.marketOpportunity],
    ["Traction", deal.traction],
    ["Team", deal.team],
    ["Use of funds", deal.useOfFunds],
    ["AI diligence summary", deal.diligenceSummary],
    ["Risk disclosures", deal.riskDisclosures],
  ];

  return (
    <AppShell role={shellRole}>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{deal.industry}</p>
            <h1 className="mt-3 flex flex-wrap items-center gap-3 text-4xl font-semibold tracking-tight text-slate-950">
              {deal.companyName}
              {deal.capitalReadyAt ? <CapitalReadyBadge /> : null}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{deal.shortSummary}</p>
            <p className="mt-3 text-sm text-slate-500">
              {[deal.stage, deal.location].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--navy)] bg-[var(--navy)] p-5 text-white shadow-[var(--shadow-panel)] lg:min-w-64">
            <p className="text-sm text-slate-300">Published</p>
            <p className="mt-2 text-2xl font-semibold">
              {deal.publishedAt
                ? new Date(deal.publishedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Recently"}
            </p>
            <p className="mt-2 text-sm text-slate-300">Admin-reviewed listing</p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Funding target</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{deal.fundingTarget ?? "TBD"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Minimum investment</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{deal.minimumInvestment ?? "TBD"}</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <CompanyPledgeSummaryBlock summary={pledgeSummary} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.42fr]">
        <div className="grid gap-4">
          {sections.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body ?? "Not provided."}</p>
            </article>
          ))}
        </div>
        <InvestorDealActions
          companyId={deal.id}
          companySlug={deal.slug}
          companyName={deal.companyName}
          viewerRole={viewerRole}
          isOwnCompany={isOwnCompany}
          pitchDeckDocumentId={pitchDeckDocumentId}
          signInNextPath={`/deals/${deal.slug}`}
        />
      </section>

      <div className="mt-8">
        <ComplianceNotice />
      </div>
    </AppShell>
  );
}
