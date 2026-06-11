import Link from "next/link";
import { CheckCircle2, FileText, Brain, BarChart3, Users, ArrowRight } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const features = [
  {
    icon: Brain,
    title: "AI Diligence Engine",
    description:
      "Upload documents and receive AI-generated summaries, gap detection, and investor-ready diligence briefs with human review checkpoints.",
    color: "bg-[var(--blue-muted)] text-[var(--blue)]",
  },
  {
    icon: BarChart3,
    title: "Readiness Scoring",
    description:
      "Structured readiness scorecard aligned to institutional investor expectations. Track progress, close gaps, and know when you're ready.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: FileText,
    title: "Private Data Rooms",
    description:
      "Bank-grade document storage with role-based access controls, signed URLs, and full audit trails for every document interaction.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: Users,
    title: "Investor Matching",
    description:
      "Rules-based matching against platform investors using your sector, stage, geography, and check size preferences.",
    color: "bg-amber-50 text-amber-600",
  },
];

const steps = [
  {
    step: "01",
    title: "Submit your company",
    description: "Enter company details, funding target, stage, traction metrics, and use of funds.",
  },
  {
    step: "02",
    title: "Upload diligence documents",
    description: "Pitch deck, financials, cap table, legal documents — all stored privately with signed access.",
  },
  {
    step: "03",
    title: "Complete readiness scoring",
    description: "AI flags gaps, generates summaries, and tracks remediation tasks until you reach publish-ready status.",
  },
  {
    step: "04",
    title: "Publish to the marketplace",
    description: "Admin-approved listings go live with full compliance disclosures and investor-facing diligence context.",
  },
];

const included = [
  "Investor readiness scorecard",
  "AI diligence document analysis",
  "Private deal room with audit trail",
  "Rules-based investor matching",
  "SPV opportunity tracking",
  "Compliance event monitoring",
  "Capital raise progress dashboard",
  "Company update broadcasts",
];

export default function FoundersPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="px-4 py-10 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <CapitalOSLogo height={48} priority className="mb-7" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">For founders</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-[var(--navy)] md:text-5xl">
              Become capital-ready before entering the market.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              CapitalOS gives founders the infrastructure to organize diligence, prove readiness, and approach
              investors with institutional-grade preparation — not just a deck.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/submit-company"
                className="cap-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
              >
                Submit your company
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              </Link>
              <Link
                href="/deals"
                className="cap-btn-secondary inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold"
              >
                Browse the marketplace
              </Link>
            </div>
          </div>
          <MarketingDashboardPreview />
        </div>
      </section>

      {/* What's included */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">Platform access</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Everything you need to go from draft to investor-ready.
          </h2>
          <div className="mt-7 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {included.map((item) => (
              <div key={item} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} aria-hidden />
                <span className="text-sm font-medium text-slate-800">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">Core capabilities</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Built for the institutional raise process.
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

      {/* How it works */}
      <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-10 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">How it works</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            From first submission to marketplace listing.
          </h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.step} className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
                <span className="text-xs font-bold tracking-widest text-[var(--gold)]">{s.step}</span>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{s.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{s.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/submit-company"
              className="cap-btn-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
            >
              Get started — it&apos;s free
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
