import Link from "next/link";
import { Gauge, Star, LayoutGrid, ArrowRight, TrendingUp, Coins } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import type { TickerItem } from "@/components/marketing/MarketingLiveTicker";
import { MarketingMarketPreview } from "@/components/marketing/MarketingMarketPreview";
import { MarketingMarketplacePlaceholder } from "@/components/marketing/MarketingMarketplacePlaceholder";
import { MarketingScoredBoard, type ScoredBoardRow } from "@/components/marketing/MarketingScoredBoard";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { getCompanyPledgeSummaries, emptyCompanyPledgeSummary } from "@/lib/data/investor-pledges";
import { listMarketplaceListings } from "@/lib/data/marketplace";
import { filterPublicMarketplaceListings } from "@/lib/marketplace/public-listings";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Private Market — diligence-ready opportunities",
  description:
    "Browse admin-approved companies with full diligence context. Shown for informational purposes only; not investment recommendations.",
  alternates: { canonical: "/deals" },
  openGraph: {
    title: "The Private Market · iCapOS",
    description: "Admin-approved, diligence-ready opportunities. Informational only.",
    url: "/deals",
  },
};

const TWO_SIDED = [
  { icon: Gauge, title: "Founders earn readiness", copy: "A 0–100 Capital Readiness Score across five diligence dimensions. Only diligence-ready deals reach the market.", color: "bg-[var(--teal-muted)] text-[var(--teal)]" },
  { icon: Star, title: "Investors earn quality", copy: "A two-sided rating means founders see investor quality too — who's active, who deploys, who follows through.", color: "bg-[var(--indigo-soft)] text-[var(--indigo)]" },
  { icon: LayoutGrid, title: "Activity in the open", copy: "Indicated interest, reviews, and score moves are visible — so both sides see a market that's genuinely alive.", color: "bg-[var(--blue-muted)] text-[var(--blue)]" },
];

const DEAL_TICKER: TickerItem[] = [
  { Icon: Coins, tone: "teal", label: "AI vision deal", detail: "+$500K indicated", when: "2d" },
  { Icon: TrendingUp, tone: "teal", label: "Healthtech deal", detail: "84 readiness", when: "3d" },
  { Icon: Star, tone: "indigo", label: "Top-quartile investor", detail: "reviewed a deal", when: "4d" },
  { Icon: TrendingUp, tone: "amber", label: "AI deal", detail: "72% indicated", when: "5d" },
  { Icon: Coins, tone: "teal", label: "Climate deal", detail: "+$300K indicated", when: "6d" },
];

const TICKER_TONE: Record<string, string> = {
  teal: "bg-[var(--teal-muted)] text-[var(--teal)]",
  indigo: "bg-[var(--indigo-soft)] text-[var(--indigo)]",
  blue: "bg-[var(--blue-muted)] text-[var(--blue)]",
  amber: "bg-amber-50 text-amber-600",
};

const MARKET_STATS = [
  { v: "$4.2M", l: "indicated · 30d", tone: "text-[var(--teal)]" },
  { v: "42", l: "active investors", tone: "text-[var(--navy)]" },
  { v: "23", l: "diligence-ready", tone: "text-[var(--navy)]" },
  { v: "76.8", l: "avg readiness", tone: "text-[var(--indigo)]" },
];

const DEAL_ROWS: ScoredBoardRow[] = [
  { symbol: "FOX·EYES", name: "FoxEyes Vision AI", score: 84.0, band: "high", metricMain: "72% indicated", metricSub: "$1.8M / $2.5M", tags: ["AI", "Vision"] },
  { symbol: "DMND·AI", name: "Diamond AI", score: 80.5, band: "high", metricMain: "60% indicated", metricSub: "$1.2M / $2.0M", tags: ["AI", "Infra"] },
  { symbol: "HEART·SX", name: "HeartScoreX MRI", score: 76.4, band: "mid", metricMain: "44% indicated", metricSub: "$880K / $2.0M", tags: ["Health"] },
  { symbol: "VRDE·Ca", name: "Verde Cargo", score: 62.8, band: "low", metricMain: "18% indicated", metricSub: "$270K / $1.5M", tags: ["Climate"] },
];

export default async function DealsPage() {
  const t = await getTranslations("appPages");
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
        style={{ background: "radial-gradient(960px 460px at 75% -10%, var(--blue-muted), transparent 70%)" }}
      >
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--blue-border)] bg-[var(--blue-muted)] px-3.5 py-1.5 font-mono text-[11.5px] text-[var(--blue)]">
              <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--blue)] text-[var(--blue)]" />
              Investor marketplace
            </span>
            <h1 className="mt-5 max-w-[16ch] text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--navy)] md:text-5xl">
              The <span className="text-[var(--blue)]">{t("private_market")}</span> where readiness meets capital.
            </h1>
            <p className="mt-5 max-w-[46ch] text-base leading-7 text-slate-600">
              Scored founders, quality investors, and indicated interest in the open. Listings are shown for
              informational purposes only and are not investment recommendations.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/auth/sign-up" className="cap-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold">
                Request access
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              </Link>
              <Link href="/investors" className="cap-btn-secondary inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">
                How it works →
              </Link>
            </div>
          </div>
          <MarketingMarketPreview />
        </div>
      </section>

      {/* Illustrative deal activity + market preview */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Ticker + stats + board — one connected card */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
            {/* ticker = connected top strip */}
            <div className="cap-marquee-host relative flex h-11 items-center overflow-hidden border-b border-slate-200" role="group" aria-label="Sample marketplace activity">
              <ul className="sr-only">
                {DEAL_TICKER.map((e, i) => (
                  <li key={`sr-${e.label}-${i}`}>
                    {e.label}{e.detail ? `, ${e.detail}` : ""} — {e.when}
                  </li>
                ))}
              </ul>
              <span className="z-10 flex h-full items-center gap-2 border-r border-slate-200 bg-white px-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--teal)]">
                <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
                Sample
              </span>
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" aria-hidden />
              <div className="cap-marquee flex w-max items-center whitespace-nowrap" aria-hidden="true">
                {[...DEAL_TICKER, ...DEAL_TICKER].map((e, i) => {
                  const Icon = e.Icon;
                  return (
                    <span key={`${e.label}-${i}`} className="flex h-5 items-center gap-2 border-r border-slate-200 px-5 text-[12.5px] text-slate-600">
                      <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-md ${TICKER_TONE[e.tone]}`}>
                        <Icon className="h-3 w-3" strokeWidth={2} />
                      </span>
                      <span className="font-mono text-[12px] font-semibold text-[var(--navy)]">{e.label}</span>
                      {e.detail ? <span className="font-mono text-[11px] text-slate-500">{e.detail}</span> : null}
                      <span className="font-mono text-[10px] text-slate-400">{e.when}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 border-b border-slate-200 sm:grid-cols-4">
              {MARKET_STATS.map((s, i) => (
                <div
                  key={s.l}
                  className={`border-slate-200 px-5 py-5 text-center ${i < MARKET_STATS.length - 1 ? "sm:border-r" : ""} ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b sm:border-b-0" : ""}`}
                >
                  <div className={`font-mono text-[23px] font-semibold ${s.tone}`}>{s.v}</div>
                  <div className="mt-1.5 font-mono text-[10px] text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>

            {/* board */}
            <MarketingScoredBoard
              title={t("diligence_ready_deals")}
              meta="4 deals · ranked by readiness"
              scoreLabel="Readiness"
              metricLabel="Indicated"
              rows={DEAL_ROWS}
              note="Illustrative"
              bare
            />
          </div>

          <p className="mt-3 text-center font-mono text-[10px] text-slate-400">
            Illustrative preview — sample figures, not live platform data.
          </p>
        </div>
      </section>

      {/* Live listings (real data) */}
      <section className="border-t border-slate-200/80 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">{t("live_marketplace")}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--navy)]">{t("published_opportunities")}</h2>
            </div>
            <p className="font-mono text-sm font-medium text-slate-500">
              {listings.length} {listings.length === 1 ? "listing" : "listings"} live · admin-approved
            </p>
          </div>
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

      {/* Two-sided explainer */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">{t("a_two_sided_market")}</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            Both sides scored. Both sides see the market move.
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {TWO_SIDED.map((c) => (
              <div key={c.title} className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[var(--shadow-panel)] transition hover:shadow-[var(--shadow-card)]">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.color}`}>
                  <c.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--navy)]">{c.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{c.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
