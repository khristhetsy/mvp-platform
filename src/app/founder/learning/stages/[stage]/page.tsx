import Link from "next/link";
import { notFound } from "next/navigation";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import {
  CAPITAL_STAGE_META,
  CAPITAL_STAGE_MODULES,
  CAPITAL_STAGE_UNLOCK_THRESHOLD,
  computeCapitalStagePercent,
  computeCapitalStageAccess,
  getModulesForStage,
  type CapitalStage,
} from "@/lib/learning/capital-stages";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

const PREV_STAGE: Partial<Record<CapitalStage, CapitalStage>> = {
  stage_1: "stage_0",
  stage_2: "stage_1",
  stage_3: "stage_2",
};

export default async function StageContentPage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage: stageParam } = await params;

  if (!STAGES.includes(stageParam as CapitalStage)) {
    notFound();
  }
  const stage = stageParam as CapitalStage;
  const meta = CAPITAL_STAGE_META[stage];

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
  const adminAny = admin as any;

  const { data: rawOverrideRows } = company
    ? await adminAny.from("admin_learning_stage_overrides").select("capital_stage, is_unlocked").eq("founder_id", profile.id).eq("company_id", company.id)
    : { data: [] };
  type OverrideRow = { capital_stage: string; is_unlocked: boolean };
  const overrideRows = (rawOverrideRows ?? []) as OverrideRow[];

  const overrides: Partial<Record<CapitalStage, boolean>> = {};
  for (const row of overrideRows) {
    overrides[row.capital_stage as CapitalStage] = row.is_unlocked;
  }

  const stageAccess = computeCapitalStageAccess(completedKeys, overrides);
  const unlocked = stageAccess[stage];
  const pct = computeCapitalStagePercent(stage, completedKeys);

  // Load deliverable submission if any
  type DeliverableRow = { ai_score: number | null; ai_feedback: string | null; submitted_at: string };
  const { data: rawDeliverableRow } = company
    ? await adminAny.from("learning_deliverable_submissions").select("ai_score, ai_feedback, submitted_at").eq("founder_id", profile.id).eq("company_id", company.id).eq("capital_stage", stage).eq("deliverable_id", meta.deliverable.id).maybeSingle()
    : { data: null };
  const deliverableRow = rawDeliverableRow as DeliverableRow | null;

  const modules = getModulesForStage(stage);
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = modules.reduce(
    (s, m) => s + m.lessons.filter((l) => completedKeys.has(`${m.slug}:${l.id}`)).length,
    0,
  );

  // Load admin-created courses tagged to this stage
  type AdminCourse = { id: string; title: string; description: string; difficulty: string | null };
  const { data: rawAdminCourses } = await admin
    .from("learning_programs")
    .select("id, title, description, difficulty")
    .eq("readiness_focus", stage)
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  const adminCourses = (rawAdminCourses ?? []) as AdminCourse[];

  const prevStage = PREV_STAGE[stage];
  const prevMeta = prevStage ? CAPITAL_STAGE_META[prevStage] : null;
  const prevPct = prevStage ? computeCapitalStagePercent(prevStage, completedKeys) : 100;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="elearning">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={meta.subtitle}
            title={meta.label}
            description={
              unlocked
                ? `${completedLessons} of ${totalLessons} lessons completed · ${pct}% done`
                : `This stage is locked — complete ${prevMeta?.label ?? "the previous stage"} at ${CAPITAL_STAGE_UNLOCK_THRESHOLD}%+ to unlock`
            }
            actions={
              <Link
                href="/founder/learning"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Overview
              </Link>
            }
          />

          {/* Locked gate */}
          {!unlocked && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
              <p className="text-4xl">🔒</p>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">Stage locked</h2>
              <p className="mt-2 text-sm text-slate-600">
                Complete{" "}
                {prevMeta ? (
                  <Link href={`/founder/learning/stages/${prevStage}`} className="font-semibold text-indigo-700 hover:underline">
                    {prevMeta.label}
                  </Link>
                ) : (
                  "the previous stage"
                )}{" "}
                at {CAPITAL_STAGE_UNLOCK_THRESHOLD}%+ to unlock this stage.
              </p>
              {prevMeta && (
                <div className="mx-auto mt-4 max-w-xs">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-slate-500">{prevMeta.label}</span>
                    <span className="font-semibold text-amber-700">{prevPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${prevPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-amber-700">
                    {CAPITAL_STAGE_UNLOCK_THRESHOLD - prevPct > 0
                      ? `Need ${CAPITAL_STAGE_UNLOCK_THRESHOLD - prevPct}% more to unlock`
                      : "Almost there!"}
                  </p>
                </div>
              )}
              <Link
                href={prevStage ? `/founder/learning/stages/${prevStage}` : "/founder/learning"}
                className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Continue {prevMeta?.label ?? "learning"}
              </Link>
            </div>
          )}

          {/* Unlocked: content */}
          {unlocked && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                {/* Progress bar */}
                <div
                  className="overflow-hidden rounded-2xl border p-5"
                  style={{ background: meta.bgColor, borderColor: meta.borderColor }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: meta.color }}>
                      {pct}% complete
                    </span>
                    <span className="text-xs" style={{ color: meta.color }}>
                      {completedLessons} / {totalLessons} lessons
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/50">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                  {pct >= CAPITAL_STAGE_UNLOCK_THRESHOLD ? (
                    <p className="mt-2 text-xs font-semibold" style={{ color: meta.color }}>
                      ✓ Stage complete — next stage unlocked
                    </p>
                  ) : (
                    <p className="mt-2 text-xs" style={{ color: meta.color }}>
                      {CAPITAL_STAGE_UNLOCK_THRESHOLD - pct}% more to unlock the next stage
                    </p>
                  )}
                </div>

                {/* Modules + lessons */}
                {modules.map((mod) => {
                  const modCompleted = mod.lessons.filter((l) => completedKeys.has(`${mod.slug}:${l.id}`)).length;
                  const firstIncomplete = mod.lessons.findIndex((l) => !completedKeys.has(`${mod.slug}:${l.id}`));
                  return (
                    <div key={mod.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900">{mod.title}</h3>
                          <span className="text-xs text-slate-400">
                            {modCompleted}/{mod.lessons.length} done
                          </span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {mod.lessons.map((lesson, idx) => {
                          const done = completedKeys.has(`${mod.slug}:${lesson.id}`);
                          const isCurrent = idx === firstIncomplete;
                          return (
                            <div
                              key={lesson.id}
                              id={lesson.id}
                              className={`flex items-start gap-4 px-6 py-4 ${isCurrent ? "bg-indigo-50/40" : ""}`}
                            >
                              <div
                                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  done
                                    ? "bg-green-100 text-green-700"
                                    : isCurrent
                                      ? "bg-indigo-600 text-white"
                                      : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {done ? "✓" : idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p
                                    className={`text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}
                                  >
                                    {lesson.title}
                                  </p>
                                  <span className="text-xs text-slate-400">{lesson.durationMinutes} min</span>
                                  {isCurrent && !done && (
                                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                      Up next
                                    </span>
                                  )}
                                  {done && (
                                    <span className="rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                      Done
                                    </span>
                                  )}
                                </div>
                                {lesson.summary && (
                                  <p className="mt-1 text-xs text-slate-500">{lesson.summary}</p>
                                )}
                                {/* Key points preview for next lesson */}
                                {isCurrent && !done && lesson.keyPoints && lesson.keyPoints.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {lesson.keyPoints.slice(0, 2).map((kp, kpIdx) => (
                                      <li key={kpIdx} className="flex items-start gap-1.5 text-xs text-slate-600">
                                        <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                                        {kp}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              {isCurrent && !done && (
                                <Link
                                  href={`/founder/learning/courses/${mod.slug}/${lesson.id}`}
                                  className="flex-shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                                >
                                  Start →
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right: deliverable */}
              <div className="space-y-4">
                <div
                  className="overflow-hidden rounded-2xl border"
                  style={{ borderColor: meta.borderColor }}
                >
                  <div
                    className="border-b px-5 py-4"
                    style={{ background: meta.bgColor, borderColor: meta.borderColor }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: meta.color }}>
                      Stage deliverable
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">{meta.deliverable.title}</h3>
                  </div>
                  <div className="bg-white p-5">
                    <p className="text-xs text-slate-500">{meta.deliverable.description}</p>
                    {deliverableRow ? (
                      <div className="mt-4 rounded-lg bg-green-50 p-3">
                        <p className="text-xs font-semibold text-green-700">
                          ✓ Submitted
                          {deliverableRow.ai_score != null && ` · AI score: ${deliverableRow.ai_score}/100`}
                        </p>
                        {deliverableRow.ai_feedback && (
                          <p className="mt-1 text-xs text-green-600">{deliverableRow.ai_feedback}</p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p className="mb-2 text-xs text-slate-400">Not yet submitted</p>
                        <Link
                          href={`/founder/learning/stages/${stage}/deliverable`}
                          className="block w-full rounded-lg border border-slate-200 bg-white py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Submit deliverable →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin-created courses for this stage */}
                {adminCourses.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                        {meta.icon} Additional courses
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {adminCourses.map((course) => (
                        <Link
                          key={course.id}
                          href={`/founder/learning/courses/${course.id}`}
                          className="flex items-start gap-3 px-5 py-4 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900">{course.title}</p>
                            {course.description && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{course.description}</p>
                            )}
                          </div>
                          <span
                            className="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize"
                            style={{ background: meta.bgColor, color: meta.color }}
                          >
                            {course.difficulty ?? "course"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Navigation to other stages */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">All stages</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {STAGES.map((s) => {
                      const sm = CAPITAL_STAGE_META[s];
                      const sp = computeCapitalStagePercent(s, completedKeys);
                      const su = stageAccess[s];
                      return (
                        <Link
                          key={s}
                          href={`/founder/learning/stages/${s}`}
                          className={`flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 ${s === stage ? "bg-slate-50" : ""}`}
                        >
                          <span className="text-sm">{su ? sm.icon : "🔒"}</span>
                          <span className={`flex-1 text-xs font-medium ${su ? "text-slate-800" : "text-slate-400"}`}>
                            {sm.label}
                          </span>
                          <span className={`text-xs font-semibold ${su ? "text-indigo-600" : "text-slate-300"}`}>
                            {su ? `${sp}%` : "—"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </WorkspacePageContainer>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
