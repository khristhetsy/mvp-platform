import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
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

const BADGES = [
  { id: "foundation-complete", icon: "🏅", label: "Foundation complete", requireStage: "stage_0" as CapitalStage, requirePct: 100 },
  { id: "seed-started", icon: "🌱", label: "Seed journey started", requireStage: "stage_1" as CapitalStage, requirePct: 10 },
  { id: "seed-complete", icon: "🚀", label: "Seed-ready", requireStage: "stage_1" as CapitalStage, requirePct: 80 },
  { id: "series-a", icon: "💼", label: "Series A track", requireStage: "stage_2" as CapitalStage, requirePct: 50 },
  { id: "exit-ready", icon: "🏆", label: "Exit ready", requireStage: "stage_3" as CapitalStage, requirePct: 80 },
  { id: "first-lesson", icon: "⚡", label: "First lesson done", requireStage: "stage_0" as CapitalStage, requirePct: 1 },
];

export default async function MyProgressPage() {
  const profile = await requireRole(["founder"]);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawOverrideRows } = company
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
            eyebrow="Learning"
            title="My progress"
            description="Completion by stage, quiz scores, and badges earned."
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
                  <h2 className="text-sm font-semibold text-slate-900">Stage completion</h2>
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
                  <h2 className="text-sm font-semibold text-slate-900">Recent quiz scores</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {(quizAttempts ?? []).length === 0 ? (
                    <p className="px-6 py-4 text-sm text-slate-400">No quiz attempts yet.</p>
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
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
                          {badge.icon}
                        </div>
                        <p className="text-[10px] leading-tight text-slate-500">{badge.label}</p>
                        {earned && (
                          <p className="mt-0.5 text-[9px] font-semibold text-green-700">Earned</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 px-5 py-3 text-center">
                  <p className="text-xs text-slate-400">Complete stages to unlock badges</p>
                </div>
              </div>
            </div>
          </div>
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
