import Link from "next/link";
import { Bot, Lock, ShieldCheck, Sparkles, Brain, BarChart3, Building2, TrendingUp, Star, Coins, Eye } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingLiveTicker, type TickerItem } from "@/components/marketing/MarketingLiveTicker";
import { MarketingScoredBoard, type ScoredBoardRow } from "@/components/marketing/MarketingScoredBoard";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";

const trustBadges = [
  { icon: Sparkles, label: "AI-Powered Diligence" },
  { icon: Lock, label: "Bank-Grade Security" },
  { icon: ShieldCheck, label: "Built for Compliance" },
];

const TICKER: TickerItem[] = [
  { Icon: TrendingUp, tone: "amber", label: "NVST·AK", detail: "$2.1M deployed", when: "3m" },
  { Icon: Star, tone: "indigo", label: "MRDN·7", detail: "→ FOX·EYES", when: "11m" },
  { Icon: Coins, tone: "teal", label: "NVST·AK", detail: "+$500K → FOX·EYES", when: "18m" },
  { Icon: Eye, tone: "blue", label: "HLO·CAP", detail: "reviewed HEART·SX", when: "26m" },
  { Icon: TrendingUp, tone: "teal", label: "VRT·X", detail: "quality 73.2", when: "35m" },
  { Icon: Star, tone: "indigo", label: "HLO·CAP", detail: "→ DMND·AI", when: "1h" },
];

const DEAL_ROWS: ScoredBoardRow[] = [
  { symbol: "FOX·EYES", name: "FoxEyes Vision AI", score: 84.0, band: "high", metricMain: "72% indicated", metricSub: "$1.8M / $2.5M", tags: ["AI", "Vision"] },
  { symbol: "DMND·AI", name: "Diamond AI", score: 80.5, band: "high", metricMain: "60% indicated", metricSub: "$1.2M / $2.0M", tags: ["AI", "Infra"] },
  { symbol: "HEART·SX", name: "HeartScoreX MRI", score: 76.4, band: "mid", metricMain: "44% indicated", metricSub: "$880K / $2.0M", tags: ["Health"] },
  { symbol: "VRDE·Ca", name: "Verde Cargo", score: 62.8, band: "low", metricMain: "18% indicated", metricSub: "$270K / $1.5M", tags: ["Climate"] },
];

const featureCards = [
  { title: "AI Diligence", copy: "Summarize documents, flag gaps, and generate investor-ready diligence briefs with human review checkpoints.", icon: Brain, iconBg: "bg-[var(--blue-muted)]", iconColor: "text-[var(--blue)]" },
  { title: "Investor Readiness", copy: "Structured readiness scoring, remediation tasks, and campaign preparation aligned to institutional review.", icon: BarChart3, iconBg: "bg-[var(--teal-muted)]", iconColor: "text-[var(--teal)]" },
  { title: "Secure Data Rooms", copy: "Private document rooms with role-based access, audit visibility, and bank-grade storage policies.", icon: Lock, iconBg: "bg-[var(--indigo-soft)]", iconColor: "text-[var(--indigo)]" },
  { title: "Marketplace Access", copy: "Publish admin-approved opportunities with disclosures, risk context, and non-binding investor actions.", icon: Building2, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
];

export default function Home() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section
        className="px-4 py-10 lg:px-8 lg:py-14"
        style={{ background: "radial-gradient(960px 460px at 75% -10%, var(--blue-muted), transparent 70%)" }}
      >
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div className="flex flex-col justify-center">
            <CapitalOSLogo height={52} priority className="mb-6" />
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--blue-border)] bg-[var(--blue-muted)] px-3.5 py-1.5 font-mono text-[11.5px] text-[var(--blue)]">
              <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--blue)] text-[var(--blue)]" />
              One private market where readiness meets capital
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-[var(--navy)] md:text-5xl lg:text-[3.25rem]">
              The operating system for capital-ready companies.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 md:text-lg">
              AI diligence, investor readiness, data rooms, and marketplace preparation — all in one institutional platform.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/auth/sign-up" className="cap-btn-primary rounded-lg px-5 py-2.5 text-center text-sm font-semibold">
                Get Started as Founder
              </Link>
              <Link href="/investors" className="cap-btn-secondary rounded-lg px-5 py-2.5 text-center text-sm font-semibold">
                Explore as Investor
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
          <MarketingDashboardPreview />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200/80 py-5">
          <CapitalOSLogo height={40} />
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-500">
            <span>Trusted by founders preparing institutional raises</span>
            <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
            <span className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-[var(--blue)]" strokeWidth={1.75} />
              AI-assisted workflows
            </span>
          </div>
        </div>
      </section>

      {/* Live private market preview */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--blue)]">The Private Market</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            Both sides scored. Both sides see the market move.
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-center text-sm text-slate-600">
            Scored founders, quality investors, and indicated interest in the open — a preview of the surface members use.
          </p>
          <div className="mt-8">
            <MarketingLiveTicker items={TICKER} label="Sample · Private Market activity" />
          </div>
          <div className="mt-6">
            <MarketingScoredBoard
              title="Diligence-ready deals"
              meta="4 deals · ranked by readiness"
              scoreLabel="Readiness"
              metricLabel="Indicated"
              rows={DEAL_ROWS}
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
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

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
