"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Rocket, ShieldCheck, Search, Briefcase, type LucideIcon } from "lucide-react";
import type { getAllInvestorStageGuides } from "@/lib/investor/stage-guides";

type Guide = ReturnType<typeof getAllInvestorStageGuides>[number];

const STAGE_ICON: Record<string, LucideIcon> = {
  onboarding: Rocket,
  verification: ShieldCheck,
  access: Search,
  manage: Briefcase,
};

function askAssistant() {
  window.dispatchEvent(
    new CustomEvent("icapos-assistant:ask", {
      detail: { prompt: "Give me an overview of how iCapOS works for investors and what I should do first." },
    }),
  );
}

export function InvestorHelpClient({ guides }: { guides: Guide[] }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-indigo,#2E78F5)]">Help</p>
      <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">How iCapOS works</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
        Your investing runs in four stages. Each one opens its full step-by-step guide, the same guidance you see inside
        each stage. You can also ask the AI assistant anything.
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={askAssistant}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-slate-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask the AI assistant
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {guides.map((guide) => {
          const Icon = STAGE_ICON[guide.slug] ?? Rocket;
          return (
            <Link
              key={guide.slug}
              href={`/investor/stages/${guide.slug}`}
              className="group block rounded-xl border border-[var(--border-subtle)] bg-white p-4 transition-colors hover:border-[var(--brand-indigo,#2E78F5)]/40 hover:bg-slate-50/60"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-indigo,#2E78F5)]/10 text-[var(--brand-indigo,#2E78F5)]">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                      {guide.stageLabel} {"—"} {guide.title}
                    </h2>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-[var(--brand-indigo,#2E78F5)]" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{guide.intro}</p>
                  <p className="mt-2 text-xs text-slate-400">{guide.stepTitles.join(" · ")}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
