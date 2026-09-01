"use client";

import Link from "next/link";
import { ArrowRight, Play, Rocket, ClipboardCheck, Megaphone, FlagTriangleRight, Sparkles, type LucideIcon } from "lucide-react";
import type { StageGuide } from "@/lib/founder/stage-guides";
import { FOUNDER_TOUR_EVENT } from "@/components/founder/FounderTour";

// Icon per stage slug — mirrors the sidebar stage icons.
const STAGE_ICON: Record<string, LucideIcon> = {
  onboarding: Rocket,
  preparation: ClipboardCheck,
  marketing: Megaphone,
  closing: FlagTriangleRight,
};

function startTour() {
  window.dispatchEvent(new CustomEvent(FOUNDER_TOUR_EVENT));
}

function askAssistant() {
  window.dispatchEvent(
    new CustomEvent("icapos-assistant:ask", {
      detail: { prompt: "Give me an overview of how iCapOS works and what I should do first." },
    }),
  );
}

export function HelpCenterClient({ guides }: { guides: StageGuide[] }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-indigo,#2E78F5)]">Help</p>
      <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">How iCapOS works</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
        Your raise runs in four stages. Each one below opens its full step-by-step guide — the same guidance you see
        inside each stage. Prefer a walkthrough? Take the tour, or ask the AI assistant anything.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startTour}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5" />
          Take the tour
        </button>
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
          const steps = guide.steps.map((s) => s.title).join(" · ");
          return (
            <Link
              key={guide.slug}
              href={`/founder/stages/${guide.slug}`}
              className="group block rounded-xl border border-[var(--border-subtle)] bg-white p-4 transition-colors hover:border-[var(--brand-indigo,#2E78F5)]/40 hover:bg-slate-50/60"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-indigo,#2E78F5)]/10 text-[var(--brand-indigo,#2E78F5)]">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                      {guide.stageLabel} — {guide.title}
                    </h2>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[var(--brand-indigo,#2E78F5)]" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{guide.intro}</p>
                  <p className="mt-2 text-xs text-slate-400">{steps}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-slate-50/60 p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Still stuck?</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Open the AI assistant from any page (the spark button, bottom-right) for help with what&apos;s in front of you,
          or reach the team from{" "}
          <Link href="/founder/support" className="font-medium text-[var(--brand-indigo,#2E78F5)] hover:underline">
            Support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
