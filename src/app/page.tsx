import Link from "next/link";
import { Bot, Lock, ShieldCheck, Sparkles, Brain, BarChart3, Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingScoredBoard, type ScoredBoardRow } from "@/components/marketing/MarketingScoredBoard";
import { MarketingCompanySpec } from "@/components/marketing/MarketingCompanySpec";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { IcapOSLogo } from "@/components/IcapOSLogo";
import { loadPublicMarketStats } from "@/lib/marketing/market-stats";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  ORGANIZATION_JSONLD,
  SOFTWARE_APPLICATION_JSONLD,
  FAQ_ITEMS,
  faqPageJsonLd,
} from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "iCapOS — The operating system for capital-ready companies" },
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

const trustBadges = [
  { icon: Sparkles, label: "AI-Powered Diligence" },
  { icon: Lock, label: "Bank-Grade Security" },
  { icon: ShieldCheck, label: "Built for Compliance" },
];

const featureCards = [
  { title: "AI Diligence", copy: "Summarize documents, flag gaps, and generate investor-ready diligence briefs with human review checkpoints.", icon: Brain, iconBg: "bg-[var(--blue-muted)]", iconColor: "text-[var(--blue)]" },
  { title: "Investor Readiness", copy: "Structured readiness scoring, remediation tasks, and campaign preparation aligned to institutional review.", icon: BarChart3, iconBg: "bg-[var(--teal-muted)]", iconColor: "text-[var(--teal)]" },
  { title: "Secure Data Rooms", copy: "Private document rooms with role-based access, audit visibility, and bank-grade storage policies.", icon: Lock, iconBg: "bg-[var(--indigo-soft)]", iconColor: "text-[var(--indigo)]" },
  { title: "Marketplace Access", copy: "Publish admin-approved opportunities with disclosures, risk context, and non-binding investor actions.", icon: Building2, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
];

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: n >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n);
}

function band(readiness: number | null): "high" | "mid" | "low" {
  if (readiness == null) return "low";
  if (readiness >= 80) return "high";
  if (readiness >= 70) return "mid";
  return "low";
}

export default async function Home() {
  const stats = await loadPublicMarketStats();
  const t = await getTranslations("appPages");

  const statCells = [
    { v: money(stats.indicated30d), l: "indicated · 30d", tone: "text-[var(--teal)]" },
    { v: String(stats.activeInvestors), l: "active investors", tone: "text-[var(--navy)]" },
    { v: String(stats.diligenceReady), l: "diligence-ready", tone: "text-[var(--navy)]" },
    { v: stats.avgReadiness > 0 ? stats.avgReadiness.toFixed(1) : "0", l: "avg readiness", tone: "text-[var(--indigo)]" },
  ];

  const dealRows: ScoredBoardRow[] = stats.deals.map((d) => ({
    symbol: d.symbol,
    name: d.name,
    score: d.readiness ?? 0,
    band: band(d.readiness),
    trendDelta: d.trendDelta,
    metricMain: d.fillPct != null ? `${d.fillPct}% indicated` : "0% indicated",
    metricSub: d.fundingTarget != null ? `${money(d.totalIndicated)} / ${money(d.fundingTarget)}` : "no target",
    tags: d.sector ? [d.sector] : [],
  }));

  const tickerLoop = [...stats.deals, ...stats.deals];

  // Hero readiness card — wired to real platform data.
  const avg = stats.avgReadiness;
  const gaugeOffset = 182 - (182 * Math.min(100, Math.max(0, avg))) / 100;
  const readinessLabel = avg <= 0 ? "Awaiting data" : avg >= 80 ? "Strong" : avg >= 70 ? "Moderate" : "Building";
  const readinessRows = stats.deals.slice(0, 5).map((d) => ({
    label: d.symbol,
    pct: d.readiness != null ? Math.min(100, Math.max(0, d.readiness)) : 0,
    value: d.readiness != null ? Math.round(d.readiness).toString() : "—",
  }));

  return (
    <MarketingShell>
      {/* Hero */}
      <section
        className="px-4 py-10 lg:px-8 lg:py-14"
        style={{ background: "radial-gradient(960px 460px at 75% -10%, var(--blue-muted), transparent 70%)" }}
      >
        <div className="mx-auto grid max-w-5xl gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
          <div className="flex flex-col justify-center">
            <IcapOSLogo height={52} tagline priority className="mb-6" />
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--indigo-soft)] bg-[var(--indigo-soft)] px-3.5 py-1.5 font-mono text-[11.5px] text-[var(--indigo)]">
              <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--indigo)] text-[var(--indigo)]" />
              Live · {money(stats.indicated30d)} indicated · 30d
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-[var(--navy)] md:text-5xl lg:text-[3.25rem]">
              The operating system for <span className="text-[var(--indigo)]">capital-ready</span> companies.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 md:text-lg">
              AI diligence, investor readiness, secure data rooms, and a private market where scored founders meet
              quality investors.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/auth/sign-up" className="cap-btn-primary rounded-lg px-5 py-3 text-center text-sm font-semibold">
                Get started as founder
              </Link>
              <Link href="/investors" className="cap-btn-secondary rounded-lg px-5 py-3 text-center text-sm font-semibold">
                Explore as investor
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {trustBadges.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                  <Icon className="h-3.5 w-3.5 text-[var(--blue)]" strokeWidth={1.75} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Market readiness card — real platform data */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-4">
              <div className="relative h-[72px] w-[72px] shrink-0">
                <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="36" cy="36" r="29" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle cx="36" cy="36" r="29" fill="none" stroke="var(--teal)" strokeWidth="6" strokeLinecap="round" strokeDasharray="182" strokeDashoffset={gaugeOffset} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[21px] font-bold text-[var(--teal)]">
                  {avg > 0 ? Math.round(avg) : 0}
                </span>
              </div>
              <div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400">Avg readiness</div>
                <div className="mt-0.5 text-[17px] font-bold text-[var(--navy)]">{readinessLabel}</div>
                <div className="font-mono text-[11px] text-slate-400">{stats.diligenceReady} diligence-ready</div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              {readinessRows.length > 0 ? (
                readinessRows.map((d) => (
                  <div key={d.label} className="grid grid-cols-[78px_1fr_28px] items-center gap-2.5 text-[11.5px] text-slate-500">
                    <span className="truncate font-mono text-[10.5px] text-[var(--navy)]">{d.label}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <span className="block h-full rounded-full bg-[var(--teal)]" style={{ width: `${d.pct}%` }} />
                    </span>
                    <span className="text-right font-mono font-semibold text-[var(--navy)]">{d.value}</span>
                  </div>
                ))
              ) : (
                <p className="py-3 text-center text-[12px] text-slate-400">
                  No published companies yet — scores appear as the marketplace fills.
                </p>
              )}
            </div>
            <Link href="/deals" className="mt-5 block rounded-lg bg-[var(--navy)] py-2.5 text-center text-[13px] font-semibold text-white">
              Explore the market →
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-between gap-4 border-y border-slate-200/80 py-5">
          <IcapOSLogo height={40} tagline />
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-500">
            <span>{t("trusted_by_founders_preparing_institutional_ra")}</span>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <span className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-[var(--blue)]" strokeWidth={1.75} />
              AI-assisted workflows
            </span>
          </div>
        </div>
      </section>

      {/* Live private market — real data */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">{t("the_private_market")}</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            Scored founders. Quality investors. Real activity.
          </h2>

          {/* Ticker + stats + deal board — one connected card */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
            {/* ticker = connected top strip */}
            {stats.deals.length > 0 ? (
              <div className="cap-marquee-host relative flex h-11 items-center overflow-hidden border-b border-slate-200" role="group" aria-label="Live private market activity">
                {/* Static screen-reader list — single pass, no motion announced. */}
                <ul className="sr-only">
                  {stats.deals.map((d) => (
                    <li key={`sr-${d.symbol}`}>
                      {d.symbol}{d.sector ? `, ${d.sector}` : ""}, readiness {d.readiness != null ? d.readiness.toFixed(1) : "not yet rated"}, {d.fillPct != null ? `${d.fillPct}% indicated` : "0% indicated"}
                    </li>
                  ))}
                </ul>
                <span className="z-10 flex h-full items-center gap-2 border-r border-slate-200 bg-white px-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--teal)]">
                  <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
                  Live
                </span>
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" aria-hidden />
                <div className="cap-marquee flex w-max items-center whitespace-nowrap" aria-hidden="true">
                  {tickerLoop.map((d, i) => (
                    <span key={`${d.symbol}-${i}`} className="flex h-5 items-center gap-2 border-r border-slate-200 px-5 text-[12.5px]">
                      <span className="font-mono text-[12px] font-semibold text-[var(--navy)]">{d.symbol}</span>
                      {d.sector ? <span className="font-mono text-[11px] text-slate-400">{d.sector}</span> : null}
                      <span className="font-mono text-[11px] text-slate-500">
                        {d.readiness != null ? `readiness ${d.readiness.toFixed(1)}` : "readiness —"}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[var(--teal)]">
                        {d.fillPct != null ? `${d.fillPct}% indicated` : "0% indicated"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* stats */}
            <div className="grid grid-cols-2 border-b border-slate-200 sm:grid-cols-4">
              {statCells.map((s, i) => (
                <div
                  key={s.l}
                  className={`border-slate-200 px-5 py-5 text-center ${i < statCells.length - 1 ? "sm:border-r" : ""} ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b sm:border-b-0" : ""}`}
                >
                  <div className={`font-mono text-[23px] font-semibold ${s.tone}`}>{s.v}</div>
                  <div className="mt-1.5 font-mono text-[10px] text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>

            {/* deal board */}
            {dealRows.length > 0 ? (
              <MarketingScoredBoard
                title={t("diligence_ready_deals")}
                meta={`${dealRows.length} live · ranked by readiness`}
                scoreLabel="Readiness"
                metricLabel="Indicated"
                rows={dealRows}
                note="Live"
                bare
                showTrend
              />
            ) : (
              <p className="px-5 py-6 text-center text-sm text-slate-500">
                No published deals on the marketplace yet. Approved companies appear here once diligence and publication
                are complete.
              </p>
            )}
          </div>

          {/* Featured deal spotlight — company spec + readiness chart */}
          <div className="mt-6">
            <MarketingCompanySpec />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-9 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">{t("the_platform")}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
              Everything you need, in one institutional platform.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => (
              <article key={card.title} className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)] transition hover:shadow-[var(--shadow-card)]">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}>
                  <card.icon className={`h-[18px] w-[18px] ${card.iconColor}`} strokeWidth={1.75} aria-hidden />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-[var(--navy)]">{card.title}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-600">{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">{t("faq")}</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            Common questions
          </h2>
          <dl className="mx-auto mt-9 max-w-3xl divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="px-6 py-5">
                <dt className="text-sm font-semibold text-[var(--navy)]">{item.q}</dt>
                <dd className="mt-2 text-sm leading-6 text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <JsonLd data={ORGANIZATION_JSONLD} />
      <JsonLd data={SOFTWARE_APPLICATION_JSONLD} />
      <JsonLd data={faqPageJsonLd(FAQ_ITEMS)} />

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
