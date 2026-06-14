import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listPublishedAdminCourses } from "@/lib/learning/admin-courses";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  stage_0: { label: "Stage 0 — Foundation", bg: "#EFF6FF", text: "#1D4ED8" },
  stage_1: { label: "Stage 1 — Seed Round", bg: "#F0FDF4", text: "#15803D" },
  stage_2: { label: "Stage 2 — Series A", bg: "#FFF7ED", text: "#C2410C" },
  stage_3: { label: "Stage 3 — Exit", bg: "#FAF5FF", text: "#7E22CE" },
  general: { label: "General", bg: "#F1F5F9", text: "#475569" },
};

const FILTER_STAGES = [
  { value: "", label: "All stages" },
  { value: "stage_0", label: "Stage 0" },
  { value: "stage_1", label: "Stage 1" },
  { value: "stage_2", label: "Stage 2" },
  { value: "stage_3", label: "Stage 3" },
  { value: "general", label: "General" },
];

const FILTER_DIFFICULTY = [
  { value: "", label: "All levels" },
  { value: "introductory", label: "Introductory" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

type PageProps = {
  searchParams: Promise<{ stage?: string; difficulty?: string }>;
};

export default async function BrowseCoursesPage({ searchParams }: PageProps) {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const { stage: stageFilter = "", difficulty: difficultyFilter = "" } = await searchParams;

  const allCourses = await listPublishedAdminCourses();

  const courses = allCourses.filter((c) => {
    if (stageFilter && c.readiness_focus !== stageFilter) return false;
    if (difficultyFilter && c.difficulty !== difficultyFilter) return false;
    return true;
  });

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="elearning">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Learning"
            title="Browse all courses"
            description="Curated by the CapitalOS team — available at any stage."
          />

          {/* Back link */}
          <div className="mb-6">
            <Link href="/founder/learning" className="text-sm text-indigo-600 hover:underline">
              ← Learning hub
            </Link>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4">
            {/* Stage filter */}
            <div className="flex flex-wrap gap-1.5">
              {FILTER_STAGES.map((s) => {
                const active = stageFilter === s.value;
                const params = new URLSearchParams();
                if (s.value) params.set("stage", s.value);
                if (difficultyFilter) params.set("difficulty", difficultyFilter);
                return (
                  <Link
                    key={s.value}
                    href={`/founder/learning/courses${params.toString() ? `?${params}` : ""}`}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {s.label}
                  </Link>
                );
              })}
            </div>

            <div className="h-auto w-px bg-slate-200" />

            {/* Difficulty filter */}
            <div className="flex flex-wrap gap-1.5">
              {FILTER_DIFFICULTY.map((d) => {
                const active = difficultyFilter === d.value;
                const params = new URLSearchParams();
                if (stageFilter) params.set("stage", stageFilter);
                if (d.value) params.set("difficulty", d.value);
                return (
                  <Link
                    key={d.value}
                    href={`/founder/learning/courses${params.toString() ? `?${params}` : ""}`}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-slate-800 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {d.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Results count */}
          <p className="mb-4 text-xs text-slate-400">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
            {(stageFilter || difficultyFilter) && " matching your filters"}
          </p>

          {/* Card grid */}
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
              <p className="text-3xl">📚</p>
              <p className="mt-3 text-sm font-medium text-slate-700">No courses found</p>
              <p className="mt-1 text-xs text-slate-400">Try removing a filter or check back soon.</p>
              <Link
                href="/founder/learning/courses"
                className="mt-4 inline-block text-xs font-semibold text-indigo-600 hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const stageBadge = STAGE_LABELS[course.readiness_focus ?? "general"] ?? STAGE_LABELS.general;
                return (
                  <Link
                    key={course.id}
                    href={`/founder/learning/courses/${course.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-indigo-200 hover:shadow-sm"
                  >
                    {/* Banner */}
                    <div className="relative h-28 flex-shrink-0 bg-slate-100">
                      {course.banner_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.banner_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 text-3xl">
                          📚
                        </div>
                      )}
                      {/* Video badge */}
                      {course.video_url && (
                        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          ▶ Video
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col gap-2.5 p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: stageBadge.bg, color: stageBadge.text }}
                        >
                          {stageBadge.label}
                        </span>
                        {course.difficulty && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-500">
                            {course.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold leading-snug text-slate-900">{course.title}</p>
                      {course.description && (
                        <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">
                          {course.description}
                        </p>
                      )}
                      <span className="mt-1 text-xs font-semibold text-indigo-600 group-hover:underline">
                        View course →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
