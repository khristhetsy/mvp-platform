import Link from "next/link";
import { courseHref } from "@/lib/learning/course-keys";
import { getProgramForModuleSlug } from "@/lib/learning/catalog";
import type { FounderLearningModuleView } from "@/lib/learning/load-founder-learning";

function statusLabel(status: string | null | undefined) {
  if (!status || status === "not_started") return "Not started";
  return status.replaceAll("_", " ");
}

export function FounderLearningModuleCard({
  module,
  highlight,
  locked = false,
  lockMessage,
}: Readonly<{
  module: FounderLearningModuleView;
  highlight?: string;
  locked?: boolean;
  lockMessage?: string;
}>) {
  const percent = module.progress?.percent_complete ?? 0;
  const status = module.progress?.status ?? "not_started";
  const program = getProgramForModuleSlug(module.slug);
  const courseSlugByModule: Record<string, string> = {
    "investor-ready-company-profiles": "investor-readiness-masterclass",
    "pitch-deck-fundamentals": "investor-ready-pitch-deck",
    "financial-projections": "startup-financial-forecasting",
    "investor-materials": "data-room-preparation",
    "governance-basics": "founder-governance-basics",
    "investor-updates": "fundraising-communication",
    "long-term-capital-strategy": "capital-strategy-foundations",
  };
  const linkedCourseSlug = courseSlugByModule[module.slug];

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        locked ? "border-slate-200 bg-slate-50 opacity-90" : "border-slate-200 bg-white"
      }`}
    >
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
      {locked ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <span aria-hidden>🔒</span>
          {lockMessage ?? "Complete the previous stage to unlock"}
        </p>
      ) : null}
      {highlight && !locked ? <p className="mt-2 text-xs font-medium text-indigo-700">{highlight}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{module.estimated_time_minutes} min</span>
        <span>{percent}% complete</span>
        {(module.score_points ?? 0) > 0 ? (
          <span className="font-medium text-emerald-700">
            +{module.score_points} readiness points on completion
          </span>
        ) : null}
        {module.related_remediation_category ? (
          <span className="rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-slate-100">
            {module.related_remediation_category.replaceAll("_", " ")}
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {locked ? (
          <span className="inline-flex rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">
            Locked
          </span>
        ) : (
          <>
            <Link
              href={linkedCourseSlug ? courseHref(linkedCourseSlug) : `/founder/learning/${program.slug}`}
              className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {status === "completed" ? "Review course" : status === "in_progress" ? "Continue" : "Open course"}
            </Link>
            <Link
              href={`/founder/learning/${module.slug}`}
              className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Module view
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
