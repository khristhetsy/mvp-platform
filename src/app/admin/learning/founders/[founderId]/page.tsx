import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  CAPITAL_STAGE_META,
  CAPITAL_STAGE_MODULES,
  CAPITAL_STAGE_UNLOCK_THRESHOLD,
  computeCapitalStageAccess,
  computeCapitalStagePercent,
  type CapitalStage,
} from "@/lib/learning/capital-stages";
import { AdminLearningStageOverridePanel } from "@/components/admin/learning/AdminLearningStageOverridePanel";
import { AdminLessonAssignmentPanel } from "@/components/admin/learning/AdminLessonAssignmentPanel";

export const dynamic = "force-dynamic";

const STAGES: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

type OverrideRow = {
  capital_stage: string;
  is_unlocked: boolean;
  overridden_by: string;
  overridden_at: string;
  notes: string | null;
};

type AssignmentRow = {
  module_slug: string;
  lesson_id: string;
  lesson_title: string;
  assigned_by: string;
  assigned_at: string;
};

type DeliverableRow = {
  ai_score: number | null;
  ai_feedback: string | null;
  submitted_at: string;
};

type UcRow = {
  company_id: string;
  companies: { company_name: string } | null;
};

export default async function AdminFounderLearningDetailPage({
  params,
}: {
  params: Promise<{ founderId: string }>;
}) {
  const { founderId } = await params;
  const adminProfile = await requireRole(["admin", "analyst"]);
  const t = await getTranslations("learnAdmin");
  const admin = createServiceRoleClient();

  // Load founder profile
  const { data: founder } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", founderId)
    .maybeSingle();

  if (!founder) notFound();

  // Load company
  const { data: rawUserCompany } = await admin
    .from("user_companies")
    .select("company_id, companies(company_name)")
    .eq("user_id", founderId)
    .maybeSingle();

  const userCompany = rawUserCompany as unknown as UcRow | null;
  const companyId = userCompany?.company_id;
  const companyName = userCompany?.companies?.company_name ?? "—";

  // Load lesson progress
  const { data: progressRows } = await admin
    .from("founder_lesson_progress")
    .select("module_slug, lesson_id, status")
    .eq("founder_id", founderId)
    .eq("status", "completed");

  type ProgressRow = { module_slug: string; lesson_id: string; status: string };
  const completedKeys = new Set(
    ((progressRows ?? []) as ProgressRow[]).map((r) => `${r.module_slug}:${r.lesson_id}`),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // Load stage overrides (new table — cast)
  const { data: rawOverrides } = await db
    .from("admin_learning_stage_overrides")
    .select("capital_stage, is_unlocked, overridden_by, overridden_at, notes")
    .eq("founder_id", founderId);

  const overrideRows = (rawOverrides ?? []) as OverrideRow[];

  const overrides: Partial<Record<CapitalStage, boolean>> = {};
  for (const row of overrideRows) {
    overrides[row.capital_stage as CapitalStage] = row.is_unlocked;
  }

  const stageAccess = computeCapitalStageAccess(completedKeys, overrides);
  const stagePercents = Object.fromEntries(
    STAGES.map((s) => [s, computeCapitalStagePercent(s, completedKeys)]),
  ) as Record<CapitalStage, number>;

  const rating = Math.round(
    stagePercents.stage_0 * 0.25 +
    stagePercents.stage_1 * 0.35 +
    stagePercents.stage_2 * 0.25 +
    stagePercents.stage_3 * 0.15,
  );

  // Load lesson assignments (new table — cast)
  const { data: rawAssignments } = await db
    .from("admin_lesson_assignments")
    .select("module_slug, lesson_id, lesson_title, assigned_by, assigned_at")
    .eq("founder_id", founderId);

  const assignmentRows = (rawAssignments ?? []) as AssignmentRow[];
  const assignedKeys = new Set(assignmentRows.map((r) => `${r.module_slug}:${r.lesson_id}`));

  const allLessons = CAPITAL_STAGE_MODULES.flatMap((mod) =>
    mod.lessons.map((lesson) => ({
      key: `${mod.slug}:${lesson.id}`,
      moduleSlug: mod.slug,
      moduleTitle: mod.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      stage: mod.stage,
      durationMinutes: lesson.durationMinutes,
      done: completedKeys.has(`${mod.slug}:${lesson.id}`),
      assigned: assignedKeys.has(`${mod.slug}:${lesson.id}`),
    })),
  );

  type Recommendation = { text: string };
  const recommendations: Recommendation[] = [];
  if (stagePercents.stage_0 < 100) {
    recommendations.push({ text: "Founder hasn't completed Stage 0 Foundation — assign foundational lessons first." });
  }
  if (stagePercents.stage_1 > 0 && stagePercents.stage_1 < CAPITAL_STAGE_UNLOCK_THRESHOLD) {
    recommendations.push({
      text: `Stage 1 at ${stagePercents.stage_1}% — ${CAPITAL_STAGE_UNLOCK_THRESHOLD - stagePercents.stage_1}% more needed to unlock Series A. Consider assigning valuation and pitch deck lessons.`,
    });
  }
  if (completedKeys.size === 0) {
    recommendations.push({ text: "No lessons started yet — assign a quick first lesson to get them started." });
  }

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={adminProfile.full_name ?? adminProfile.email ?? "Admin"}
      profileSubtitle={adminProfile.role}
      profileEmail={adminProfile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow={t("eyebrowOps")}
          title={founder.full_name ?? founder.email ?? founderId}
          description={`${companyName} · Rating: ${rating}/100 · ${completedKeys.size} lessons completed`}
          actions={
            <Link
              href="/admin/learning/founders"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Founder roster
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STAGES.map((s) => {
            const meta = CAPITAL_STAGE_META[s];
            const pct = stagePercents[s];
            const unlocked = stageAccess[s];
            return (
              <div
                key={s}
                className="rounded-2xl border p-4 text-center"
                style={{ borderColor: meta.borderColor, background: unlocked ? meta.bgColor : "#F8FAFC" }}
              >
                <p className="text-lg">{unlocked ? meta.icon : "🔒"}</p>
                <p className="mt-1 text-xl font-bold" style={{ color: unlocked ? meta.color : "#94A3B8" }}>
                  {unlocked ? `${pct}%` : "—"}
                </p>
                <p className="text-[10px] text-slate-500">{meta.subtitle}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AdminLearningStageOverridePanel
            founderId={founderId}
            companyId={companyId ?? ""}
            adminName={adminProfile.full_name ?? adminProfile.email ?? "Admin"}
            stages={STAGES.map((s) => ({
              stage: s,
              label: CAPITAL_STAGE_META[s].label,
              pct: stagePercents[s],
              autoUnlocked: stageAccess[s],
              overrideUnlocked: overrides[s],
              overrideRow: overrideRows.find((r) => r.capital_stage === s) ?? null,
            }))}
          />

          <AdminLessonAssignmentPanel
            founderId={founderId}
            companyId={companyId ?? ""}
            adminName={adminProfile.full_name ?? adminProfile.email ?? "Admin"}
            lessons={allLessons}
          />
        </div>

        {recommendations.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-700">
              🤖 Performance recommendations
            </p>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm text-amber-800">
                  <span className="mt-0.5 text-amber-500">→</span>
                  <span>{rec.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </WorkspacePageContainer>
    </AppShell>
  );
}
