import Link from "next/link";
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

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

export default async function FounderLearningPage() {
  const profile = await requireRole(["founder"]);
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
            eyebrow="Founder workspace"
            title="Learning overview"
            description="Track your capital readiness journey across all 4 stages."
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Stage ladder + this week */}
            <div className="space-y-4 lg:col-span-2">
              {/* Stage ladder */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-900">Capital readiness stages</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Complete each stage at 80%+ to unlock the next</p>
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
                  <p className="mt-0.5 text-xs text-slate-500">Your current stage — pick up where you left off</p>
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
                    <p className="px-6 py-4 text-sm text-slate-400">No lessons available for this stage yet.</p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Quick actions</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { href: "/founder/learning/plan", icon: "🤖", label: "My AI learning plan" },
                    { href: "/founder/learning/schedule", icon: "📅", label: "View my schedule" },
                    { href: "/founder/learning/progress", icon: "📈", label: "Progress & badges" },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                    >
                      <span className="text-base">{link.icon}</span>
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
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
