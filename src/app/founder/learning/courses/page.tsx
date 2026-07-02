import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listPublishedAdminCourses } from "@/lib/learning/admin-courses";
import { CAPITAL_STAGE_MODULES, CAPITAL_STAGE_META, type CapitalStage } from "@/lib/learning/capital-stages";

export const dynamic = "force-dynamic";

const STAGE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  stage_0: { label: "Stage 0", bg: "#EFF6FF", text: "#1D4ED8" },
  stage_1: { label: "Stage 1", bg: "#F0FDF4", text: "#15803D" },
  stage_2: { label: "Stage 2", bg: "#FFF7ED", text: "#C2410C" },
  stage_3: { label: "Stage 3", bg: "#FAF5FF", text: "#7E22CE" },
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

type BrowseCourse = {
  key: string;
  title: string;
  description: string;
  difficulty: string | null;
  readiness_focus: string;
  banner_image_url: string | null;
  video_url: string | null;
  href: string;
  isStatic: boolean;
  isLinked: boolean;
};

type PageProps = {
  searchParams: Promise<{ stage?: string; difficulty?: string }>;
};

export default async function BrowseCoursesPage({ searchParams }: PageProps) {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const { stage: stageFilter = "", difficulty: difficultyFilter = "" } = await searchParams;

  // DB courses
  const dbCourses = await listPublishedAdminCourses();
  const dbBySlug = new Map(dbCourses.map((c) => [c.slug, c]));
  const dbSlugs = new Set(dbCourses.map((c) => c.slug));

  // Build merged list: static modules first, then pure-DB courses (no matching static slug)
  const combined: BrowseCourse[] = [];

  for (const mod of CAPITAL_STAGE_MODULES) {
    const db = dbBySlug.get(mod.slug);
    const stageMeta = CAPITAL_STAGE_META[mod.stage as CapitalStage];
    combined.push({
      key: mod.slug,
      title: db?.title ?? mod.title,
      description: db?.description ?? stageMeta.subtitle,
      difficulty: db?.difficulty ?? stageMeta.level.toLowerCase(),
      readiness_focus: mod.stage,
      banner_image_url: db?.banner_image_url ?? null,
      video_url: db?.video_url ?? null,
      href: `/founder/learning/courses/${mod.slug}/${mod.lessons[0]?.id ?? ""}`,
      isStatic: true,
      isLinked: !!db,
    });
  }

  // Pure admin courses (no matching capital stage slug)
  for (const c of dbCourses) {
    if (!dbSlugs.has(c.slug) || CAPITAL_STAGE_MODULES.every((m) => m.slug !== c.slug)) {
      if (!CAPITAL_STAGE_MODULES.some((m) => m.slug === c.slug)) {
        combined.push({
          key: c.id,
          title: c.title,
          description: c.description,
          difficulty: c.difficulty,
          readiness_focus: c.readiness_focus ?? "general",
          banner_image_url: c.banner_image_url,
          video_url: c.video_url,
          href: `/founder/learning/courses/${c.id}`,
          isStatic: false,
          isLinked: true,
        });
      }
    }
  }

  // Apply filters
  const courses = combined.filter((c) => {
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
            eyebrow={t("learning")}
            title={t("browse_all_courses")}
            description={t("capital_stage_lessons_and_curated_courses_all")}
          />

          <div className="mb-6">
            <Link href="/founder/learning" className="text-sm text-indigo-600 hover:underline">
              ← Learning hub
            </Link>
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
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
                        : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {s.label}
                  </Link>
                );
              })}
            </div>
            <div className="h-5 w-px bg-slate-200" />
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
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {d.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <p className="mb-4 text-xs text-slate-400">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
            {(stageFilter || difficultyFilter) && " matching your filters"}
            {" · "}
            <span className="text-slate-400">
              Static = built-in lessons &nbsp;·&nbsp; Admin-linked = enriched with video &amp; modules
            </span>
          </p>

          {courses.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
              <p className="text-3xl">📚</p>
              <p className="mt-3 text-sm font-medium text-slate-700">{t("no_courses_found")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("try_removing_a_filter")}</p>
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
                const badge = STAGE_BADGE[course.readiness_focus] ?? STAGE_BADGE.general;
                return (
                  <Link
                    key={course.key}
                    href={course.href}
                    className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition hover:shadow-sm ${
                      course.isLinked
                        ? "border-indigo-200 hover:border-indigo-400"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
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
                        <div
                          className="flex h-full items-center justify-center text-3xl"
                          style={{ background: badge.bg }}
                        >
                          📚
                        </div>
                      )}
                      {course.video_url && (
                        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          ▶ Video
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {badge.label}
                        </span>
                        {course.isLinked ? (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                            Admin-linked
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            Static
                          </span>
                        )}
                        {course.difficulty && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-400">
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
                        {course.isStatic ? "View lessons →" : "View course →"}
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
