import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { OpportunityCard } from "@/components/OpportunityCard";
import { filterPublicMarketplaceListings } from "@/lib/marketplace/public-listings";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import {
  formatPublicCommittedTotal,
  formatPublicInterestCount,
  formatPublicReadinessImprovement,
  getPublicPlatformMetrics,
} from "@/lib/data/public-platform-metrics";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const readinessSteps = [
  "Company profile and funding strategy intake",
  "Secure diligence room and document completeness review",
  "AI diligence summary, traction validation, and risk flags",
  "Admin approval, campaign preparation, and marketplace publication",
];

const capabilities = [
  {
    number: "01",
    title: "AI diligence engine",
    copy: "Summarize documents, identify missing materials, flag diligence risks, and generate investor-ready review briefs.",
  },
  {
    number: "02",
    title: "Crowdfunding readiness",
    copy: "Translate company materials into campaign structure, use-of-funds narratives, disclosures, and readiness scores.",
  },
  {
    number: "03",
    title: "Investor marketplace",
    copy: "Publish approved opportunities into a curated deal environment with summaries, risk context, and investor actions.",
  },
];

export default async function Home() {
  const supabase = createServiceRoleClient();
  let featuredListings: Awaited<ReturnType<typeof listMarketplaceListings>> = [];

  try {
    const listings = await listMarketplaceListings(supabase);
    featuredListings = filterPublicMarketplaceListings(listings).slice(0, 3);
  } catch {
    featuredListings = [];
  }

  const pledgeSummaries =
    featuredListings.length > 0
      ? await getCompanyPledgeSummaries(
          supabase,
          featuredListings.map((deal) => deal.id),
        )
      : {};

  let platformMetrics = {
    totalCommittedAmount: 0,
    totalCommittedCurrency: "USD",
    expressedInterestCount: 0,
    readinessImprovementPercent: null as number | null,
  };

  try {
    platformMetrics = await getPublicPlatformMetrics(supabase);
  } catch {
    platformMetrics = {
      totalCommittedAmount: 0,
      totalCommittedCurrency: "USD",
      expressedInterestCount: 0,
      readinessImprovementPercent: null,
    };
  }

  const tractionMetrics = [
    {
      value: formatPublicCommittedTotal(
        platformMetrics.totalCommittedAmount,
        platformMetrics.totalCommittedCurrency,
      ),
      label: "Total amount committed from investors",
    },
    {
      value: formatPublicReadinessImprovement(platformMetrics.readinessImprovementPercent),
      label: "Companies improved their Readiness Scores for Funding",
    },
    {
      value: formatPublicInterestCount(platformMetrics.expressedInterestCount),
      label: "Expressed interests by investors",
    },
  ];

  return (
    <main className="cap-marketing-surface min-h-screen text-slate-950">
      <MarketingNav />

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Capital readiness infrastructure</p>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-slate-950 md:text-7xl">
            AI-powered capital readiness for private offerings.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            CapitalOS helps companies organize diligence, validate traction, prepare investor materials, and become
            marketplace-ready without implying guaranteed funding.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/submit-company"
              className="cap-btn-primary rounded-lg px-6 py-3 text-center text-sm font-semibold"
            >
              Start Capital Readiness
            </Link>
            <Link
              href="/deals"
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-800 hover:border-indigo-300"
            >
              View Marketplace Preview
            </Link>
          </div>
          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-slate-200 pt-6">
            {[
              ["AI", "Diligence briefs"],
              ["RLS", "Private data rooms"],
              ["Admin", "Reviewed opportunities"],
            ].map(([label, detail]) => (
              <div key={label}>
                <p className="text-sm font-semibold text-slate-950">{label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <MarketingDashboardPreview />
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Building the future of venture readiness
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Real traction. Real founders. Real investor signals.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {tractionMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 lg:grid-cols-3">
          {capabilities.map((item) => (
            <article key={item.title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-sm font-semibold text-slate-400">{item.number}</p>
              <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-950">{item.title}</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-indigo-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Capital readiness workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              From raw diligence files to marketplace-ready investor review.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              The workflow mirrors the reference SaaS structure: clear steps, operational status, and measurable
              readiness signals for founders, reviewers, and investors.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {readinessSteps.map((step, index) => (
              <div key={step} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-950">
                  {index + 1}
                </span>
                <p className="mt-5 text-sm leading-6 text-slate-200">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Investor marketplace preview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Featured opportunities with diligence summaries.
            </h2>
          </div>
          <Link href="/deals" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
            Explore all opportunities
          </Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {featuredListings.length === 0 ? (
            <MarketingMarketplacePlaceholder />
          ) : (
            featuredListings.map((deal) => (
              <OpportunityCard
                key={deal.id}
                deal={deal}
                pledgeSummary={pledgeSummaries[deal.id] ?? emptyCompanyPledgeSummary()}
              />
            ))
          )}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Founder CTA</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Build a capital-ready company profile.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Organize company information, upload diligence documents, validate traction signals, and prepare a
              structured crowdfunding campaign for review.
            </p>
            <Link href="/submit-company" className="cap-btn-primary mt-6 inline-flex rounded-lg px-5 py-3 text-sm font-semibold">
              Submit company
            </Link>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Investor CTA</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Review curated opportunities with context.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Browse approved opportunities, read AI diligence summaries, compare risk disclosures, and express
              non-binding interest.
            </p>
            <Link href="/investors" className="mt-6 inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800">
              Investor access
            </Link>
          </div>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </main>
  );
}
