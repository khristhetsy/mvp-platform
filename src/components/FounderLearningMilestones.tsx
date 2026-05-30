import type { ReadinessMilestone } from "@/lib/learning/types";

export function FounderLearningMilestones({
  milestones,
  currentLabel,
  nextLabel,
}: Readonly<{
  milestones: ReadinessMilestone[];
  currentLabel: string | null;
  nextLabel: string | null;
}>) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">Current milestone</p>
        <p className="mt-1 text-lg font-semibold text-slate-950">{currentLabel ?? "Building foundation"}</p>
        {nextLabel ? <p className="mt-2 text-sm text-slate-600">{nextLabel}</p> : null}
      </div>

      <div className="grid gap-3">
        {milestones.map((milestone) => (
          <div
            key={milestone.key}
            className={`rounded-xl border px-4 py-3 ${
              milestone.achieved
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{milestone.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{milestone.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  milestone.achieved ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {milestone.achieved ? "Achieved" : "In progress"}
              </span>
            </div>
            {milestone.criteriaPending.length > 0 && !milestone.achieved ? (
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                {milestone.criteriaPending.slice(0, 3).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
