import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import {
  CAPITAL_STAGE_MODULES,
  CAPITAL_STAGE_META,
  computeCapitalStagePercent,
  computeCapitalStageAccess,
  type CapitalStage,
} from "@/lib/learning/capital-stages";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

// SVG badge icons
function BadgeMedal() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
    </svg>
  );
}
function BadgeSprout() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5.517.015.015M18.75 4.97l-.015.014M18.735 4.984A12.75 12.75 0 0 1 12 16.5a12.75 12.75 0 0 1-6.75-11.516" />
    </svg>
  );
}
function BadgeRocket() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
  );
}
function BadgeBriefcase() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
    </svg>
  );
}
function BadgeTrophy() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
    </svg>
  );
}
function BadgeLightning() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

const BADGES = [
  { id: "foundation-complete", icon: <BadgeMedal />, iconColor: "text-indigo-600", iconBg: "bg-indigo-50", label: "Foundation complete", requireStage: "stage_0" as CapitalStage, requirePct: 100 },
  { id: "seed-started", icon: <BadgeSprout />, iconColor: "text-emerald-600", iconBg: "bg-emerald-50", label: "Seed journey started", requireStage: "stage_1" as CapitalStage, requirePct: 10 },
  { id: "seed-complete", icon: <BadgeRocket />, iconColor: "text-blue-600", iconBg: "bg-blue-50", label: "Seed-ready", requireStage: "stage_1" as CapitalStage, requirePct: 80 },
  { id: "series-a", icon: <BadgeBriefcase />, iconColor: "text-violet-600", iconBg: "bg-violet-50", label: "Series A track", requireStage: "stage_2" as CapitalStage, requirePct: 50 },
  { id: "exit-ready", icon: <BadgeTrophy />, iconColor: "text-amber-600", iconBg: "bg-amber-50", label: "Exit ready", requireStage: "stage_3" as CapitalStage, requirePct: 80 },
  { id: "first-lesson", icon: <BadgeLightning />, iconColor: "text-orange-600", iconBg: "bg-orange-50", label: "First lesson done", requireStage: "stage_0" as CapitalStage, requirePct: 1 },
];

export default async function MyProgressPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

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

  const totalLessons = CAPITAL_STAGE_MODULES.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = completedKeys.size;

  const rating = Math.round(
    stagePercents.stage_0 * 0.25 +
    stagePercents.stage_1 * 0.35 +
    stagePercents.stage_2 * 0.25 +
    stagePercents.stage_3 * 0.15,
  );

  // Compute badge earnings
  const earnedBadges = BADGES.filter((b) => stagePercents[b.requireStage] >= b.requirePct);

  // Load quiz attempts for score history
  const { data: quizAttempts } = company
    ? await admin
        .from("founder_quiz_attempts")
        .select("module_slug, lesson_id, score, passed, created_at")
        .eq("founder_id", profile.id)
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="elearning">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("learning")}
            title={t("my_progress")}
            description={t("completion_by_stage_quiz_scores_and_badges_ear")}
            actions={
              <Link
                href="/founder/learning"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Overview
              </Link>
            }
          />

          {/* Stat row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Readiness rating", value: rating, suffix: "/ 100", color: "text-indigo-700" },
              { label: "Lessons completed", value: `${completedLessons}/${totalLessons}`, color: "text-slate-900" },
              { label: "Badges earned", value: earnedBadges.length, color: "text-green-700" },
              { label: "Quiz attempts", value: (quizAttempts ?? []).length, color: "text-slate-900" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                  {stat.suffix && <span className="text-sm font-normal text-slate-400"> {stat.suffix}</span>}
                </p>
                <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {/* Module completion bars */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">{t("stage_completion")}</h2>
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
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base"
                          style={{ background: unlocked ? meta.bgColor : "#F1F5F9" }}
                        >
                          {unlocked ? meta.icon : "🔒"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                            {!unlocked && (
                              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                Locked
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: pct >= 80 ? "#3B6D11" : unlocked ? "#534AB7" : "#CBD5E1",
                              }}
                            />
                          </div>
                        </div>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: pct >= 80 ? "#3B6D11" : unlocked ? "#534AB7" : "#94A3B8" }}
                        >
                          {pct}%
                        </span>
                        <span className="text-xs text-indigo-600 opacity-0 transition group-hover:opacity-100">→</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Quiz history */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">{t("recent_quiz_scores")}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {(quizAttempts ?? []).length === 0 ? (
                    <p className="px-6 py-4 text-sm text-slate-400">{t("no_quiz_attempts_yet")}</p>
                  ) : (
                    (quizAttempts ?? []).map((q) => {
                      const mod = CAPITAL_STAGE_MODULES.find((m) => m.slug === q.module_slug);
                      const lesson = mod?.lessons.find((l) => l.id === q.lesson_id);
                      const scoreColor =
                        q.score >= 80 ? "text-green-700" : q.score >= 60 ? "text-amber-700" : "text-red-700";
                      return (
                        <div key={`${q.module_slug}:${q.lesson_id}:${q.created_at}`} className="flex items-center gap-4 px-6 py-3.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">
                              {lesson?.title ?? q.lesson_id}
                            </p>
                            <p className="text-xs text-slate-400">{mod?.title ?? q.module_slug}</p>
                          </div>
                          <span className={`text-sm font-bold ${scoreColor}`}>{q.score}%</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              q.passed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                            }`}
                          >
                            {q.passed ? "Passed" : "Retry →"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right: Badges */}
            <div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Badges{" "}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      {earnedBadges.length} / {BADGES.length}
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-4 p-5">
                  {BADGES.map((badge) => {
                    const earned = earnedBadges.some((b) => b.id === badge.id);
                    return (
                      <div key={badge.id} className={`text-center ${!earned ? "opacity-30" : ""}`}>
                        <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl ${badge.iconBg} ${badge.iconColor}`}>
                          {badge.icon}
                        </div>
                        <p className="line-clamp-2 text-[10px] leading-tight text-slate-500">{badge.label}</p>
                        {earned && (
                          <p className="mt-0.5 text-[9px] font-semibold text-green-700">{t("earned")}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 px-5 py-3 text-center">
                  <p className="text-xs text-slate-400">{t("complete_stages_to_unlock_badges")}</p>
                </div>
              </div>
            </div>
          </div>
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
