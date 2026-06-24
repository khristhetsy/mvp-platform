import Link from "next/link";
import { ArrowRight, Gauge, Target, FolderLock, Coins, TrendingUp, Star, Eye } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingLiveTicker, type TickerItem } from "@/components/marketing/MarketingLiveTicker";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { filterPublicMarketplaceListings } from "@/lib/marketplace/public-listings";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TICKER: TickerItem[] = [
  { Icon: TrendingUp, tone: "amber", label: "NVST·AK", detail: "$2.1M deployed", when: "3m" },
  { Icon: Star, tone: "indigo", label: "MRDN·7", detail: "→ FOX·EYES", when: "11m" },
  { Icon: Coins, tone: "teal", label: "NVST·AK", detail: "+$500K → FOX·EYES", when: "18m" },
  { Icon: Eye, tone: "blue", label: "HLO·CAP", detail: "reviewed HEART·SX", when: "26m" },
  { Icon: TrendingUp, tone: "teal", label: "VRT·X", detail: "quality 73.2", when: "35m" },
];

const WHY = [
  { icon: Gauge, title: "Pre-screened & scored", copy: "Every deal carries a Capital Readiness Score across five diligence dimensions. Filter to the ready ones instantly.", color: "bg-[var(--indigo-soft)] text-[var(--indigo)]" },
  { icon: Target, title: "Matched to your thesis", copy: "Deals ranked by fit to your sector and stage, with a personalized match score on every opportunity.", color: "bg-[var(--blue-muted)] text-[var(--blue)]" },
  { icon: FolderLock, title: "Complete data rooms", copy: "Diligence-ready document rooms with disclosures and risk context — no chasing founders for materials.", color: "bg-[var(--teal-muted)] text-[var(--teal)]" },
  { icon: Coins, title: "Indicate interest, privately", copy: "Signal non-binding interest and track deals you're watching. Your activity stays yours.", color: "bg-slate-100 text-[var(--navy)]" },
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
      <section
        className="px-4 py-12 lg:px-8 lg:py-16"
        style={{ background: "radial-gradient(960px 460px at 78% -10%, var(--indigo-soft), transparent 70%)" }}
      >
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--indigo-soft)] bg-[var(--indigo-soft)] px-3.5 py-1.5 font-mono text-[11.5px] text-[var(--indigo)]">
              <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--indigo)] text-[var(--indigo)]" />
              For investors who value their time
            </span>
            <h1 className="mt-5 max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--navy)] md:text-5xl">
              Diligence-ready deals, <span className="text-[var(--indigo)]">scored and ranked</span> to your thesis.
            </h1>
            <p className="mt-5 max-w-[46ch] text-base leading-7 text-slate-600">
              No cold inbound, no noise. Pre-screened opportunities with readiness scores, complete data rooms, and
              disclosure context — matched to what you invest in.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/deals" className="cap-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold">
                Explore opportunities
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              </Link>
              <Link href="/auth/sign-in" className="cap-btn-secondary inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">
                Investor login
              </Link>
            </div>
          </div>

          {/* Deal proof card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--teal-muted)] font-mono text-[13px] font-semibold text-[var(--teal)]">FOX</span>
              <div className="flex-1">
                <div className="font-mono text-sm font-semibold text-[var(--navy)]">FOX·EYES</div>
                <div className="text-[11.5px] text-slate-400">Vision AI · raising $2.5M</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[20px] font-bold text-[var(--indigo)]">93</div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-slate-400">match</div>
              </div>
            </div>
            <div className="divide-y divide-slate-100 text-[12.5px]">
              <div className="flex items-center justify-between py-3.5 text-slate-500">
                <span>Readiness</span><b className="font-mono font-semibold text-[var(--teal)]">84.0 · Strong ▲3.2</b>
              </div>
              <div className="flex items-center justify-between py-3.5 text-slate-500">
                <span>Round filled</span>
                <span className="text-right">
                  <b className="font-mono font-semibold text-[var(--navy)]">72%</b>
                  <span className="mt-1 block h-[7px] w-[130px] overflow-hidden rounded-full bg-slate-200">
                    <span className="block h-full rounded-full bg-[var(--teal)]" style={{ width: "72%" }} />
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between py-3.5 text-slate-500">
                <span>Indicated interest</span><b className="font-mono font-semibold text-[var(--navy)]">$1.8M / $2.5M</b>
              </div>
              <div className="flex items-center justify-between py-3.5 text-slate-500">
                <span>Data room</span><b className="font-mono font-semibold text-[var(--indigo)]">Open</b>
              </div>
            </div>
            <Link href="/deals" className="mt-4 block rounded-lg bg-[var(--indigo)] py-2.5 text-center text-[13px] font-semibold text-white">
              Review this deal →
            </Link>
          </div>
        </div>
      </section>

      {/* Live ticker */}
      <section className="px-4 pb-2 pt-12 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <MarketingLiveTicker items={TICKER} label="Sample · what investors are doing" />
        </div>
      </section>

      {/* Why cards */}
      <section className="px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--indigo)]">Why investors use CapitalOS</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            Quality deal flow, without the work.
          </h2>
          <div className="mt-9 grid gap-5 sm:grid-cols-2">
            {WHY.map((w) => (
              <article key={w.title} className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)] transition hover:shadow-[var(--shadow-card)]">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${w.color}`}>
                  <w.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--navy)]">{w.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{w.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Live listings (real data) */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">Live marketplace</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--navy)]">Published opportunities</h2>
          <p className="mt-2 text-sm text-slate-500">
            {listings.length} {listings.length === 1 ? "listing" : "listings"} currently live · Admin-approved · Compliance disclosures included
          </p>
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
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
        </div>
      </section>

      {/* CTA band */}
      <section className="px-4 py-16 text-center lg:px-8" style={{ background: "linear-gradient(135deg, var(--indigo), var(--indigo-hover))" }}>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white">See the deals matched to your thesis.</h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[15px] text-white/85">
            Request verified investor access to the Private Market.
          </p>
          <Link href="/auth/sign-in" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[var(--navy)] transition hover:bg-slate-100">
            Request access
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
