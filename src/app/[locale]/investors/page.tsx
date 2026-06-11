import Link from "next/link";
import { ShieldCheck, Search, FileCheck, Bell, ArrowRight, CheckCircle2 } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { filterPublicMarketplaceListings } from "@/lib/marketplace/public-listings";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: Search,
    title: "Curated deal flow",
    description:
      "Browse admin-reviewed companies with full diligence context, AI summaries, and risk disclosures — not raw pitch decks.",
    color: "bg-[var(--blue-muted)] text-[var(--blue)]",
  },
  {
    icon: FileCheck,
    title: "Diligence-first workflow",
    description:
      "Every listing includes document summaries, readiness scores, and compliance event history before you engage.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: ShieldCheck,
    title: "Compliance disclosures",
    description:
      "All opportunities are presented with mandatory risk context. Non-binding interest only — no securities transactions on platform.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: Bell,
    title: "Structured engagement",
    description:
      "Intro requests, follow-ups, meetings, and SPV participation tracked in a single controlled workflow.",
    color: "bg-amber-50 text-amber-600",
  },
];

const included = [
  "Rules-based opportunity matching",
  "AI diligence summaries per company",
  "SPV participation workflow",
  "Deal room with document access",
  "Intro request & messaging system",
  "Google Calendar meeting scheduling",
  "Portfolio tracking dashboard",
  "Compliance-forward disclosures",
];

export default async function InvestorsPage() {
  const supabase = createServiceRoleClient();
  let listings: Awaited<ReturnType<typeof listMarketplaceListings>> = [];

  try {
    const raw = await listMarketplaceListings(supabase);
    listings = filterPublicMarketplaceListings(raw);
  } catch {
    listings = [];
  }

  const pledgeSummaries =
    listings.length > 0
      ? await getCompanyPledgeSummaries(
          supabase,
          listings.map((deal) => deal.id),
        )
      : {};

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="px-4 py-10 lg:px-8 lg:py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">For investors</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-[var(--navy)] md:text-5xl">
            Review curated private opportunities with diligence context.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Explore marketplace-ready companies that have passed admin review. Every listing comes with AI diligence
            summaries, risk disclosures, and compliance documentation — not just a deck.
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/deals"
              className="cap-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              Explore opportunities
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Link>
            <Link
              href="/login"
              className="cap-btn-secondary inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              Investor login
            </Link>
          </div>
        </div>
      </section>

      {/* Live listings */}
      <section className="border-t border-slate-200/80 px-4 py-10 lg:px-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">Live marketplace</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Published opportunities
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {listings.length} {listings.length === 1 ? "listing" : "listings"} currently live · Admin-approved · Compliance disclosures included
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {listings.length === 0 ? (
            <MarketingMarketplacePlaceholder />
          ) : (
            listings.map((deal) => (
              <OpportunityCard
                key={deal.id}
                deal={deal}
                pledgeSummary={pledgeSummaries[deal.id] ?? emptyCompanyPledgeSummary()}
              />
            ))
          )}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Investor workflow</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            A professional workflow built around diligence first.
          </h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {features.map((f) => (
              <article
                key={f.title}
                className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)]"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.color}`}>
                  <f.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-950">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">Platform access</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Full investor workspace — no cost to apply.
          </h2>
          <div className="mt-7 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {included.map((item) => (
              <div key={item} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} aria-hidden />
                <span className="text-sm font-medium text-slate-800">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/login"
              className="cap-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
            >
              Apply as an investor
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Link>
            <Link
              href="/deals"
              className="cap-btn-secondary inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold"
            >
              Browse without account
            </Link>
          </div>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
