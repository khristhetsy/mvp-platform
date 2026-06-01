import Link from "next/link";
import { Bot, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { ComplianceBlock } from "@/components/ComplianceBlock";
import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";

const trustBadges = [
  { icon: Sparkles, label: "AI-Powered Diligence" },
  { icon: Lock, label: "Bank-Grade Security" },
  { icon: ShieldCheck, label: "Built for Compliance" },
];

const featureCards = [
  {
    title: "AI Diligence",
    copy: "Summarize documents, flag gaps, and generate investor-ready diligence briefs with human review checkpoints.",
  },
  {
    title: "Investor Readiness",
    copy: "Structured readiness scoring, remediation tasks, and campaign preparation aligned to institutional review.",
  },
  {
    title: "Secure Data Rooms",
    copy: "Private document rooms with role-based access, audit visibility, and bank-grade storage policies.",
  },
  {
    title: "Marketplace Access",
    copy: "Publish admin-approved opportunities with disclosures, risk context, and non-binding investor actions.",
  },
];

export default function Home() {
  return (
    <MarketingShell>
      <section className="px-4 py-8 lg:px-8 lg:py-10">
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div className="flex flex-col justify-center">
            <CapitalOSLogo height={52} priority className="mb-6" />
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-[var(--navy)] md:text-5xl lg:text-[3.25rem]">
              The operating system for capital-ready companies.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 md:text-lg">
              AI diligence, investor readiness, data rooms, and marketplace preparation — all in one institutional
              platform.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/submit-company" className="cap-btn-primary rounded-lg px-5 py-2.5 text-center text-sm font-semibold">
                Get Started as Founder
              </Link>
              <Link
                href="/investors"
                className="cap-btn-secondary rounded-lg px-5 py-2.5 text-center text-sm font-semibold"
              >
                Explore as Investor
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {trustBadges.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-[var(--gold)]" strokeWidth={1.75} aria-hidden />
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
              <Bot className="h-3.5 w-3.5 text-[var(--gold)]" strokeWidth={1.75} />
              AI-assisted workflows
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)] transition hover:shadow-[var(--shadow-card)]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--navy-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--gold)]" aria-hidden />
              </div>
              <h2 className="mt-3 text-sm font-semibold text-[var(--navy)]">{card.title}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <ComplianceBlock />
      <MarketingFooter />
    </MarketingShell>
  );
}
