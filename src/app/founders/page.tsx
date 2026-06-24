import Link from "next/link";
import { ArrowRight, Brain, BarChart3, FileText, Users } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingScoredBoard, type ScoredBoardRow } from "@/components/marketing/MarketingScoredBoard";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const READINESS_DIMS = [
  { label: "Narrative", pct: 88 },
  { label: "Financials", pct: 79 },
  { label: "Materials", pct: 85 },
  { label: "Governance", pct: 82 },
  { label: "Diligence", pct: 86 },
];

const STEPS = [
  {
    n: "1",
    title: "Upload & get scored",
    copy: "Drop in your deck, financials, and cap table. AI reviews them, flags gaps, and returns a readiness score in minutes.",
  },
  {
    n: "2",
    title: "Close the gaps",
    copy: "Work through structured remediation tasks and AI diligence briefs with human review. Watch your score climb.",
  },
  {
    n: "3",
    title: "Get seen",
    copy: "Once admin-approved, your opportunity reaches the Private Market — in front of quality-scored investors actively reviewing deals.",
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: "AI Diligence Engine",
    copy: "AI summaries, gap detection, and investor-ready diligence briefs with human review checkpoints.",
    color: "bg-[var(--blue-muted)] text-[var(--blue)]",
  },
  {
    icon: BarChart3,
    title: "Readiness Scoring",
    copy: "A structured scorecard aligned to institutional review. Track progress and know when you're ready.",
    color: "bg-[var(--teal-muted)] text-[var(--teal)]",
  },
  {
    icon: FileText,
    title: "Private Data Rooms",
    copy: "Bank-grade storage with role-based access, signed URLs, and full audit trails on every document.",
    color: "bg-[var(--indigo-soft)] text-[var(--indigo)]",
  },
  {
    icon: Users,
    title: "Investor Matching",
    copy: "Rules-based matching on your sector, stage, geography, and check size against platform investors.",
    color: "bg-amber-50 text-amber-600",
  },
];

const INVESTOR_ROWS: ScoredBoardRow[] = [
  { symbol: "NVST·AK", name: "Ardent Keel Capital", score: 91.4, band: "high", metricMain: "4 pledges", metricSub: "$2.1M indicated", tags: ["AI", "SaaS"] },
  { symbol: "MRDN·7", name: "Meridian Seven", score: 87.0, band: "high", metricMain: "3 pledges", metricSub: "$1.4M indicated", tags: ["Healthtech"] },
  { symbol: "HLO·CAP", name: "Halo Bridge Partners", score: 78.6, band: "mid", metricMain: "2 pledges", metricSub: "$700K indicated", tags: ["Consumer"] },
  { symbol: "VRT·X", name: "Vertex Lane", score: 73.2, band: "mid", metricMain: "1 pledge", metricSub: "$300K indicated", tags: ["Climate"] },
  { symbol: "OAK·9", name: "Oakline Syndicate", score: 64.9, band: "low", metricMain: "0 pledges", metricSub: "—", tags: ["Generalist"] },
];

export default function FoundersPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section
        className="px-4 py-12 lg:px-8 lg:py-16"
        style={{ background: "radial-gradient(960px 460px at 78% -10%, var(--teal-muted), transparent 70%)" }}
      >
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <CapitalOSLogo height={44} priority className="mb-6" />
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-[var(--teal-muted)] px-3.5 py-1.5 font-mono text-[11.5px] text-[var(--teal)]">
              <span className="cap-ping inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)] text-[var(--teal)]" />
              For founders preparing institutional raises
            </span>
            <h1 className="mt-5 max-w-[16ch] text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--navy)] md:text-5xl">
              Become <span className="text-[var(--teal)]">capital-ready</span> — then get seen by quality investors.
            </h1>
            <p className="mt-5 max-w-[46ch] text-base leading-7 text-slate-600">
              CapitalOS scores your readiness, closes your diligence gaps with AI, and puts you in front of vetted
              investors actively deploying capital.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/submit-company" className="cap-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold">
                Get started as founder
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              </Link>
              <Link href="/auth/sign-in" className="cap-btn-secondary inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">
                Check your readiness →
              </Link>
            </div>
          </div>

          {/* Readiness proof card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-4">
              <div className="relative h-[72px] w-[72px] shrink-0">
                <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="36" cy="36" r="29" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle cx="36" cy="36" r="29" fill="none" stroke="var(--teal)" strokeWidth="6" strokeLinecap="round" strokeDasharray="182" strokeDashoffset="29" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[21px] font-bold text-[var(--teal)]">84</span>
              </div>
              <div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400">Your readiness</div>
                <div className="mt-0.5 text-[17px] font-bold text-[var(--navy)]">Strong</div>
                <div className="font-mono text-[11px] text-[var(--teal)]">▲ 3.2 this week</div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              {READINESS_DIMS.map((d) => (
                <div key={d.label} className="grid grid-cols-[78px_1fr_28px] items-center gap-2.5 text-[11.5px] text-slate-500">
                  <span>{d.label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <span className="block h-full rounded-full bg-[var(--teal)]" style={{ width: `${d.pct}%` }} />
                  </span>
                  <span className="text-right font-mono font-semibold text-[var(--navy)]">{d.pct}</span>
                </div>
              ))}
            </div>
            <Link href="/auth/sign-in" className="mt-5 block rounded-lg bg-[var(--navy)] py-2.5 text-center text-[13px] font-semibold text-white">
              View your readiness →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--teal)]">How it works</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            From first upload to investor-ready.
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[var(--shadow-panel)] transition hover:shadow-[var(--shadow-card)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--teal-muted)] font-mono text-[13px] font-semibold text-[var(--teal)]">{s.n}</span>
                <h3 className="mt-4 text-base font-semibold text-[var(--navy)]">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{s.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Private Market */}
      <section className="px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--teal)]">The Private Market</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            See the investors you&apos;ll be matched with.
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-center text-sm text-slate-600">
            Vetted investors, scored and live. Quality scores move like prices; activity reads like volume.
          </p>
          <div className="mt-8">
            <MarketingScoredBoard
              title="Investors"
              meta="5 vetted investors · sorted by quality score"
              scoreLabel="Quality"
              metricLabel="Pledge interest"
              rows={INVESTOR_ROWS}
            />
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--indigo)]">Core capabilities</p>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight text-[var(--navy)] md:text-3xl">
            Built for the institutional raise process.
          </h2>
          <div className="mt-9 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)] transition hover:shadow-[var(--shadow-card)]">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--navy)]">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{f.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="px-4 py-16 text-center lg:px-8" style={{ background: "linear-gradient(135deg, var(--teal), var(--teal-hover))" }}>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white">See where your raise stands today.</h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[15px] text-white/85">
            Get your Capital Readiness Score and a gap report — free to start.
          </p>
          <Link href="/submit-company" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[var(--navy)] transition hover:bg-slate-100">
            Check your readiness
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
