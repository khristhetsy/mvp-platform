import Link from "next/link";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { OpportunityCard } from "@/components/OpportunityCard";
import { listMarketplaceListings } from "@/lib/data/marketplace";
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
    featuredListings = listings.slice(0, 3);
  } catch {
    featuredListings = [];
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <MarketingNav />

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Capital readiness infrastructure</p>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-slate-950 md:text-7xl">
            AI-powered capital readiness for private offerings.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            IFUNDCROWD helps companies organize diligence, validate traction, prepare investor materials, and become
            marketplace-ready without implying guaranteed funding.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/submit-company"
              className="rounded-full bg-slate-950 px-7 py-3.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start Capital Readiness
            </Link>
            <Link
              href="/deals"
              className="rounded-full border border-slate-300 px-7 py-3.5 text-center text-sm font-semibold text-slate-800 hover:border-slate-950"
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

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">Capital readiness scorecard</p>
                <p className="mt-1 text-xs text-slate-500">Founder submission preview</p>
              </div>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                AI review
              </span>
            </div>
            <div className="mt-5 grid gap-4">
              {[
                ["Diligence completeness", "76%"],
                ["Investor readiness", "82/100"],
                ["Document gaps", "3 open items"],
                ["Campaign status", "Draft prepared"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className="font-semibold text-slate-950">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-8 md:grid-cols-4">
          {[
            ["8", "Diligence categories"],
            ["82", "Sample readiness score"],
            ["3", "Role-based portals"],
            ["0", "Funding guarantees"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
              <p className="mt-2 text-sm text-slate-500">{label}</p>
            </div>
          ))}
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

      <section className="bg-slate-950 text-white">
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
            <p className="col-span-full text-sm text-slate-600">
              Published marketplace listings will appear here once companies are approved and published.
            </p>
          ) : (
            featuredListings.map((deal) => <OpportunityCard key={deal.id} deal={deal} />)
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
            <Link href="/submit-company" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
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
