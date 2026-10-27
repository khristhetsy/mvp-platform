import Link from "next/link";
import type { CoachedCourseSummary } from "@/lib/learning/coach/program-summary";

/**
 * The coached course entry point. Two shapes: the full card for the learning overview and the catalog,
 * and the one line strip for the dashboard. Both carry the founder's own next step and minutes.
 */
export function CoachedCourseCard({ summary }: Readonly<{ summary: CoachedCourseSummary }>) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#0A1A40] bg-[#0A1A40] text-white" aria-label="Coached course">
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#1A6CE4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">Coached course</span>
          <span className="text-xs text-[#C9D6F2]">
            {summary.lessonCount} modules · {summary.totalMinutes} min of lessons · one a week
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold">{summary.title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#C9D6F2]">
          Your AI IR Coach reads your numbers, asks, and checks what you committed to. Module {Math.min(summary.lessonsDone + 1, summary.lessonCount)} of {summary.lessonCount}
          {summary.lessonsDone >= summary.lessonCount ? ", then the Monday review" : ""}.
        </p>
        <p className="mt-3 rounded-lg bg-[#14275A] px-3 py-2 text-sm leading-6 text-white ring-1 ring-[#2A4380]">
          <span className="font-semibold">This week:</span> {summary.line}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={summary.href} className="rounded-lg bg-[#1A6CE4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2E78F5]">
            {summary.lessonsDone === 0 ? "Start with your coach" : "Continue with your coach"}
          </Link>
          <span className="text-xs text-[#C9D6F2]">
            Next: {summary.nextLessonTitle} · about {summary.nextMinutes} min
          </span>
        </div>
      </div>
    </section>
  );
}
