import Link from "next/link";
import type { FounderLearningModuleView } from "@/lib/learning/load-founder-learning";

function statusLabel(status: string | null | undefined) {
  if (!status || status === "not_started") return "Not started";
  return status.replaceAll("_", " ");
}

export function FounderLearningModuleCard({
  module,
  highlight,
}: Readonly<{
  module: FounderLearningModuleView;
  highlight?: string;
}>) {
  const percent = module.progress?.percent_complete ?? 0;
  const status = module.progress?.status ?? "not_started";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">{module.category}</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">{module.title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase text-slate-600">
          {statusLabel(status)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
      {highlight ? <p className="mt-2 text-xs font-medium text-indigo-700">{highlight}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{module.estimated_time_minutes} min</span>
        <span>{percent}% complete</span>
        {module.related_remediation_category ? (
          <span className="rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-slate-100">
            {module.related_remediation_category.replaceAll("_", " ")}
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <Link
        href={`/founder/learning/${module.slug}`}
        className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
      >
        {status === "completed" ? "Review module" : status === "in_progress" ? "Continue" : "Start module"}
      </Link>
    </article>
  );
}
