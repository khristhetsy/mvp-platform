import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { FOUNDER_COURSES, listCourseCategories } from "@/lib/learning/courses";

export const dynamic = "force-dynamic";

const ACCENT = "#534AB7";

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  "Investor Readiness": { bg: "#EEEDFE", color: ACCENT },
  "Fundraising":        { bg: "#ecfdf5", color: "#065f46" },
  "Finance":            { bg: "#eff6ff", color: "#1d4ed8" },
  "Diligence":          { bg: "#fff7ed", color: "#c2410c" },
  "Governance":         { bg: "#fdf4ff", color: "#7e22ce" },
  "Communication":      { bg: "#f0f9ff", color: "#0369a1" },
  "Capital Strategy":   { bg: "#fefce8", color: "#854d0e" },
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "#f3f4f6", color: "#374151" };
}

export default async function InvestorLearningPage() {
  const { profile } = await requireInvestorWorkspaceSession();
  const categories = listCourseCategories();

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor account"
    >
      <PageHeader
        eyebrow="Investor workspace"
        title="Learning"
        description="Courses and guides to help you evaluate startups, structure diligence, and make better investment decisions."
        metadata={`${FOUNDER_COURSES.length} courses`}
      />

      {categories.map((cat) => {
        const courses = FOUNDER_COURSES.filter((c) => c.category === cat);
        const style = categoryStyle(cat);
        return (
          <section key={cat} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <span
                style={{ background: style.bg, color: style.color }}
                className="rounded-full px-3 py-1 text-xs font-700 font-bold"
              >
                {cat}
              </span>
              <span className="text-xs text-slate-400">{courses.length} course{courses.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const totalMins = course.sections.reduce(
                  (sum, s) => sum + s.lessons.reduce((ls, l) => ls + (l.durationMinutes ?? 0), 0),
                  0,
                );
                const lessonCount = course.sections.reduce((sum, s) => sum + s.lessons.length, 0);
                return (
                  <Link
                    key={course.slug}
                    href={`/investor/learning/${course.slug}`}
                    className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Colored header strip */}
                    <div
                      style={{ background: style.bg, borderBottom: `1px solid ${style.color}22` }}
                      className="px-5 py-4"
                    >
                      <span
                        style={{ color: style.color }}
                        className="text-xs font-bold uppercase tracking-wider"
                      >
                        {cat}
                      </span>
                    </div>

                    <div className="p-5">
                      <h3 className="mb-2 text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">
                        {course.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                        {course.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                            {totalMins}m
                          </span>
                          <span className="flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            </svg>
                            {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span
                          style={{ color: style.color }}
                          className="text-xs font-semibold"
                        >
                          Start →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}
