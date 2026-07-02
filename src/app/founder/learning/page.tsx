import Link from "next/link";
import { FloatingFounderAICoach } from "@/components/FloatingFounderAICoach";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import {
  CAPITAL_STAGE_META,
  computeCapitalStagePercent,
  computeCapitalStageAccess,
  getModulesForStage,
  type CapitalStage,
} from "@/lib/learning/capital-stages";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ─── Professional SVG icons ────────────────────────────────────────────────────

function IconLayers({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}
function IconTrendingUp({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function IconZapStage({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
function IconTarget({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function IconBrain({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  );
}
function IconCalendarDays({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/>
    </svg>
  );
}
function IconBarChart({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function stageIcon(stage: CapitalStage) {
  const colors: Record<CapitalStage, string> = {
    stage_0: "#1D4ED8",
    stage_1: "#15803D",
    stage_2: "#C2410C",
    stage_3: "#7E22CE",
  };
  const color = colors[stage] ?? "#534AB7";
  if (stage === "stage_0") return <IconLayers color={color} />;
  if (stage === "stage_1") return <IconTrendingUp color={color} />;
  if (stage === "stage_2") return <IconZapStage color={color} />;
  return <IconTarget color={color} />;
}

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

export default async function FounderLearningPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const companyName = company?.company_name ?? "Your company";

  const lessonProgress = company
    ? await listLessonProgressForCompany(profile.id, company.id)
    : [];

  const completedKeys = new Set(
    lessonProgress
      .filter((r) => r.status === "completed")
      .map((r) => `${r.module_slug}:${r.lesson_id}`),
  );

  const admin = createServiceRoleClient();
  const { data: rawOverrideRows } = company
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (admin as any).from("admin_learning_stage_overrides").select("capital_stage, is_unlocked").eq("founder_id", profile.id).eq("company_id", company.id)
    : { data: [] };
  type OverrideRow = { capital_stage: string; is_unlocked: boolean };
  const overrideRows = (rawOverrideRows ?? []) as OverrideRow[];

  const overrides: Partial<Record<CapitalStage, boolean>> = {};
  for (const row of overrideRows) {
    overrides[row.capital_stage as CapitalStage] = row.is_unlocked;
  }

  const stageAccess = computeCapitalStageAccess(completedKeys, overrides);

  const stagePercents = Object.fromEntries(
    STAGES.map((s) => [s, computeCapitalStagePercent(s, completedKeys)]),
  ) as Record<CapitalStage, number>;

  const activeStage = [...STAGES].reverse().find((s) => stageAccess[s]) ?? "stage_0";

  const activeModules = getModulesForStage(activeStage);
  const weekLessons = activeModules.flatMap((mod) =>
    mod.lessons.map((lesson) => ({
      moduleSlug: mod.slug,
      lesson,
      done: completedKeys.has(`${mod.slug}:${lesson.id}`),
    })),
  ).slice(0, 4);

  const firstIncompleteIdx = weekLessons.findIndex((l) => !l.done);

  // Browse all courses — published admin courses from learning_programs
  type PublishedCourse = {
    id: string;
    title: string;
    description: string;
    difficulty: string | null;
    readiness_focus: string | null;
    banner_image_url: string | null;
  };
  const { data: rawPublishedCourses } = await admin
    .from("learning_programs")
    .select("id, title, description, difficulty, readiness_focus, banner_image_url")
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  const publishedCourses = (rawPublishedCourses ?? []) as PublishedCourse[];

  const rating = Math.round(
    stagePercents.stage_0 * 0.25 +
    stagePercents.stage_1 * 0.35 +
    stagePercents.stage_2 * 0.25 +
    stagePercents.stage_3 * 0.15,
  );

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={companyName}
    >
      <FounderFeatureGate featureKey="elearning">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("founder_workspace_2")}
            title={t("learning_overview")}
            description={t("track_your_capital_readiness_journey_across_al")}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Stage ladder + this week */}
            <div className="space-y-4 lg:col-span-2">
              {/* Stage ladder */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">{t("capital_readiness_stages")}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{t("complete_each_stage_at_80_to_unlock_the_next")}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {STAGES.map((stage) => {
                    const meta = CAPITAL_STAGE_META[stage];
                    const pct = stagePercents[stage];
                    const unlocked = stageAccess[stage];
                    return (
                      <Link
                        key={stage}
                        href={`/founder/learning/stages/${stage}`}
                        className="group flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50"
                      >
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ background: unlocked ? meta.bgColor : "#F1F5F9" }}
                        >
                          {unlocked ? stageIcon(stage) : <IconLock />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                          <p className="text-xs text-slate-500">{meta.subtitle}</p>
                        </div>
                        {unlocked ? (
                          <>
                            <div className="w-24">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: pct >= 80 ? "#3B6D11" : "#534AB7" }}
                                />
                              </div>
                            </div>
                            <span
                              className="w-10 text-right text-xs font-semibold"
                              style={{ color: pct >= 80 ? "#3B6D11" : "#534AB7" }}
                            >
                              {pct}%
                            </span>
                          </>
                        ) : (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Locked
                          </span>
                        )}
                        <span className="text-xs text-indigo-600 opacity-0 transition group-hover:opacity-100">→</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Lessons in active stage */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Lessons in {CAPITAL_STAGE_META[activeStage].label}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">{t("your_current_stage_pick_up_where_you_left_off")}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {weekLessons.map(({ moduleSlug: _moduleSlug, lesson, done }, idx) => (
                    <Link
                      key={lesson.id}
                      href={`/founder/learning/stages/${activeStage}#${lesson.id}`}
                      className="group flex items-center gap-4 px-6 py-3.5 transition hover:bg-slate-50"
                    >
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          done
                            ? "bg-green-100 text-green-700"
                            : idx === firstIncompleteIdx
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {done ? "✓" : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}
                        >
                          {lesson.title}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{lesson.durationMinutes} min</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          done
                            ? "bg-green-50 text-green-700"
                            : idx === firstIncompleteIdx
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {done ? "Done" : idx === firstIncompleteIdx ? "Go →" : "—"}
                      </span>
                    </Link>
                  ))}
                  {weekLessons.length === 0 && (
                    <p className="px-6 py-4 text-sm text-slate-400">{t("no_lessons_available_for_this_stage_yet")}</p>
                  )}
                </div>
                <div className="border-t border-slate-100 px-6 py-3">
                  <Link
                    href={`/founder/learning/stages/${activeStage}`}
                    className="text-xs font-semibold text-indigo-700 hover:underline"
                  >
                    View all {CAPITAL_STAGE_META[activeStage].label} lessons →
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: rating ring + quick links */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Capital readiness rating
                </p>
                <div
                  className="mx-auto my-4 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#534AB7 0% ${rating}%, #F1F5F9 ${rating}% 100%)`,
                  }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                    <span className="text-xl font-bold text-indigo-700">{rating}</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{rating} / 100</p>
                <p className="mt-1 text-xs text-slate-500">
                  {rating >= 80 ? "Investor ready" : rating >= 50 ? "On track" : "Building foundations"}
                </p>
                {rating < 100 && (
                  <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                    Complete more lessons to increase your rating
                  </p>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t("quick_actions")}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {(
                    [
                      { href: "/founder/learning/plan",     svgIcon: <IconBrain color="#534AB7" />,          label: "My AI learning plan", bg: "#EEEDFB" },
                      { href: "/founder/learning/schedule", svgIcon: <IconCalendarDays color="#3B6D11" />,   label: "View my schedule",    bg: "#EAF3DE" },
                      { href: "/founder/learning/progress", svgIcon: <IconBarChart color="#92400E" />,        label: "Progress & badges",   bg: "#FEF3C7" },
                    ]
                  ).map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: link.bg }}
                      >
                        {link.svgIcon}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{link.label}</span>
                      <span className="ml-auto text-xs text-indigo-600 opacity-0 transition group-hover:opacity-100">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Course library teaser */}
          {publishedCourses.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t("library")}</p>
                  <h2 className="mt-0.5 text-sm font-semibold text-slate-900">{t("course_catalog")}</h2>
                </div>
                <Link
                  href="/founder/learning/courses"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition"
                >
                  Browse all {publishedCourses.length} courses →
                </Link>
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {publishedCourses.slice(0, 3).map((course) => {
                  const stageBadge: Record<string, { label: string; bg: string; text: string }> = {
                    stage_0: { label: "Stage 0", bg: "#EFF6FF", text: "#1D4ED8" },
                    stage_1: { label: "Stage 1", bg: "#F0FDF4", text: "#15803D" },
                    stage_2: { label: "Stage 2", bg: "#FFF7ED", text: "#C2410C" },
                    stage_3: { label: "Stage 3", bg: "#FAF5FF", text: "#7E22CE" },
                  };
                  const badge = course.readiness_focus ? stageBadge[course.readiness_focus] : null;
                  return (
                    <Link
                      key={course.id}
                      href={`/founder/learning/courses/${course.id}`}
                      className="group flex flex-col gap-2 px-5 py-4 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {badge && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: badge.bg, color: badge.text }}
                          >
                            {badge.label}
                          </span>
                        )}
                        {course.difficulty && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-500">
                            {course.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold leading-snug text-slate-900">{course.title}</p>
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{course.description}</p>
                      <span className="text-[11px] font-semibold text-indigo-600 group-hover:underline">{t("view")}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
      <FloatingFounderAICoach />
    </FounderAppShell>
  );
}
