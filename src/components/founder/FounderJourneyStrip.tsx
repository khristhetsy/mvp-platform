import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { JourneyOverview } from "@/lib/founder/stage-gate-status";

/** Compact horizontal four-stage rail for the dashboard. Same data as the vertical
 *  JourneyOverviewCard; slimmer for the top of the page. */
export function FounderJourneyStrip({ overview }: { overview: JourneyOverview }) {
  const currentNumber = overview.stages.find((s) => s.relation === "current")?.stageNumber ?? overview.stages.length;
  return (
    <section className="rounded-2xl border border-[var(--border-subtle,#e2e6ed)] bg-white p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">Your journey</span>
        <span className="text-[11px] text-[var(--brand-indigo,#2E78F5)]">Stage {currentNumber} of {overview.stages.length}</span>
      </div>
      <div className="flex items-center">
        {overview.stages.map((s, i) => {
          const last = i === overview.stages.length - 1;
          const doneColor = "#1D9E75";
          return (
            <div key={s.slug} className="flex flex-1 items-center">
              <Link href={`/founder/stages/${s.slug}`} className="flex flex-1 flex-col items-center gap-1 rounded-lg py-1 hover:bg-slate-50" title={s.line}>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    s.relation === "complete"
                      ? "text-white"
                      : s.relation === "current"
                        ? "bg-[var(--brand-indigo,#2E78F5)] text-white"
                        : "border border-slate-300 bg-white text-slate-400"
                  }`}
                  style={s.relation === "complete" ? { backgroundColor: doneColor } : undefined}
                >
                  {s.relation === "complete" ? <Check className="h-3.5 w-3.5" /> : s.relation === "locked" ? <Lock className="h-3 w-3" /> : s.stageNumber}
                </span>
                <span className={`text-[10.5px] ${s.relation === "current" ? "font-medium text-[var(--brand-indigo,#2E78F5)]" : s.relation === "locked" ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}`}>
                  {s.name}
                </span>
              </Link>
              {!last && (
                <span
                  className="mb-4 h-0.5 flex-1"
                  style={{ backgroundColor: overview.stages[i + 1].relation === "locked" && s.relation !== "current" ? "var(--border-subtle,#e2e6ed)" : s.relation === "complete" ? doneColor : s.relation === "current" ? "#2E78F5" : "var(--border-subtle,#e2e6ed)" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
