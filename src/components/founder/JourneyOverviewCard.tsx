import Link from "next/link";
import { Check, Lock, ArrowRight } from "lucide-react";
import type { JourneyOverview } from "@/lib/founder/stage-gate-status";

/**
 * Compact four-stage journey overview for the founder dashboard: where you are,
 * what's done, what's next — one line per stage from the real gate. Each stage
 * links to its guide; the current stage is highlighted with a Continue CTA.
 */
export function JourneyOverviewCard({ overview }: { overview: JourneyOverview }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle,#e2e6ed)] bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Your journey</h2>
        {overview.currentSlug ? (
          <Link
            href={`/founder/stages/${overview.currentSlug}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-indigo,#2E78F5)] hover:underline"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <ol className="mt-3">
        {overview.stages.map((s, i) => {
          const last = i === overview.stages.length - 1;
          return (
            <li key={s.slug} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    s.relation === "complete"
                      ? "bg-emerald-500 text-white"
                      : s.relation === "current"
                        ? "bg-[var(--brand-indigo,#2E78F5)] text-white"
                        : "border border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {s.relation === "complete" ? <Check className="h-3.5 w-3.5" /> : s.relation === "locked" ? <Lock className="h-3 w-3" /> : s.stageNumber}
                </span>
                {!last && <span className="my-0.5 w-px flex-1 bg-[var(--border-subtle,#e2e6ed)]" />}
              </div>

              <Link
                href={s.relation === "locked" ? `/founder/stages/${s.slug}` : `/founder/stages/${s.slug}`}
                className={`mb-2 flex-1 rounded-lg px-2 py-1.5 -ml-2 transition-colors hover:bg-slate-50 ${s.relation === "locked" ? "opacity-70" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-medium ${s.relation === "current" ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>
                    Stage {s.stageNumber} · {s.name}
                  </span>
                  {s.relation === "current" ? (
                    <span className="flex-none rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">You&rsquo;re here</span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{s.line}</div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
