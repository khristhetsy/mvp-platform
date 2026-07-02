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
  CAPITAL_STAGE_MODULES,
  computeCapitalStageAccess,
  type CapitalStage,
} from "@/lib/learning/capital-stages";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

const STAGE_LABELS: Record<CapitalStage, string> = {
  stage_0: "Stage 0 — Foundation",
  stage_1: "Stage 1 — Seed Round",
  stage_2: "Stage 2 — Series A",
  stage_3: "Stage 3 — Exit",
};

const PRIORITY_CONFIG = {
  high: { label: "High priority", bg: "bg-red-50", text: "text-red-700", border: "border-red-100" },
  medium: { label: "Medium", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  low: { label: "Low", bg: "bg-green-50", text: "text-green-700", border: "border-green-100" },
} as const;

export default async function MyLearningPlanPage() {
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

  // Load admin-assigned lessons
  const { data: rawAssignedRows } = company
    ? await adminAny.from("admin_lesson_assignments").select("module_slug, lesson_id, lesson_title").eq("founder_id", profile.id).eq("company_id", company.id)
    : { data: [] };
  type AssignedRow = { module_slug: string; lesson_id: string; lesson_title: string };
  const assignedRows = (rawAssignedRows ?? []) as AssignedRow[];

  const assignedKeys = new Set(assignedRows.map((r) => `${r.module_slug}:${r.lesson_id}`));

  // Build flat lesson list across all accessible stages, ordered: assigned first, then by stage order
  type PlanLesson = {
    key: string;
    moduleSlug: string;
    lessonId: string;
    title: string;
    stage: CapitalStage;
    stageLabel: string;
    durationMinutes: number;
    done: boolean;
    assigned: boolean;
    priority: "high" | "medium" | "low";
  };

  const planLessons: PlanLesson[] = [];

  for (const stage of STAGES) {
    if (!stageAccess[stage]) continue;
    const modules = CAPITAL_STAGE_MODULES.filter((m) => m.stage === stage);
    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        const key = `${mod.slug}:${lesson.id}`;
        const done = completedKeys.has(key);
        const assigned = assignedKeys.has(key);
        planLessons.push({
          key,
          moduleSlug: mod.slug,
          lessonId: lesson.id,
          title: lesson.title,
          stage,
          stageLabel: STAGE_LABELS[stage],
          durationMinutes: lesson.durationMinutes,
          done,
          assigned,
          priority: assigned ? "high" : stage === "stage_0" || stage === "stage_1" ? "medium" : "low",
        });
      }
    }
  }

  // Sort: admin-assigned first, then by stage, incomplete before complete
  planLessons.sort((a, b) => {
    if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
    if (a.done !== b.done) return a.done ? 1 : -1;
    return 0;
  });

  const totalLessons = planLessons.length;
  const doneLessons = planLessons.filter((l) => l.done).length;
  const assignedCount = planLessons.filter((l) => l.assigned && !l.done).length;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="elearning">
        <WorkspacePageContainer>
          <PageHeader
            eyebrow={t("learning")}
            title={t("my_learning_plan")}
            description={t("your_personalised_lesson_sequence_admin_assign")}
            actions={
              <Link
                href="/founder/learning"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Back to overview
              </Link>
            }
          />

          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total lessons", value: totalLessons },
              { label: "Completed", value: doneLessons, color: "text-green-700" },
              { label: "Admin-assigned", value: assignedCount, color: "text-indigo-700" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                <p className={`text-2xl font-bold ${stat.color ?? "text-slate-900"}`}>{stat.value}</p>
                <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Plan list */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">{t("your_lesson_order")}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {assignedCount > 0
                  ? `${assignedCount} lesson${assignedCount > 1 ? "s" : ""} assigned by your admin — shown first`
                  : "Ordered by stage and priority"}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {planLessons.map((lesson, idx) => {
                const priority = PRIORITY_CONFIG[lesson.priority];
                return (
                  <Link
                    key={lesson.key}
                    href={`/founder/learning/stages/${lesson.stage}#${lesson.lessonId}`}
                    className="group flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50"
                  >
                    {/* Number */}
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        lesson.done
                          ? "bg-green-100 text-green-700"
                          : lesson.assigned
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {lesson.done ? "✓" : idx + 1}
                    </div>
                    {/* Body */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${lesson.done ? "text-slate-400 line-through" : "text-slate-900"}`}
                      >
                        {lesson.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {lesson.stageLabel} · {lesson.durationMinutes} min
                      </p>
                    </div>
                    {/* Badges */}
                    <div className="flex items-center gap-2">
                      {lesson.assigned && !lesson.done && (
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          Admin assigned
                        </span>
                      )}
                      {!lesson.done && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${priority.bg} ${priority.text}`}
                        >
                          {priority.label}
                        </span>
                      )}
                      {lesson.done && (
                        <span className="rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          Done
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-indigo-600 opacity-0 transition group-hover:opacity-100">→</span>
                  </Link>
                );
              })}
              {planLessons.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-slate-400">
                  No lessons available yet. Complete your assessment to generate a plan.
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400">
            Your admin can adjust your lesson order and assign priority lessons based on your performance.
          </p>
        </WorkspacePageContainer>
      </FounderFeatureGate>
      <FloatingFounderAICoach />
    </FounderAppShell>
  );
}
