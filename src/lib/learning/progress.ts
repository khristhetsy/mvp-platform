import { createServiceRoleClient } from "@/lib/supabase/admin";
import { lessonCountForSlug } from "@/lib/learning/modules";
import type { LearningModuleRecord, LearningProgressRecord, LearningProgressStatus } from "@/lib/learning/types";

export async function listPublishedLearningModules() {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("learning_modules")
    .select("*")
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to load learning modules: ${error.message}`);
  }

  return (data ?? []) as LearningModuleRecord[];
}

export async function getLearningModuleBySlug(slug: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("learning_modules").select("*").eq("slug", slug).maybeSingle();

  if (error) {
    throw new Error(`Failed to load learning module: ${error.message}`);
  }

  return (data as LearningModuleRecord | null) ?? null;
}

export async function listLearningProgressForCompany(founderId: string, companyId: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("learning_progress")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`Failed to load learning progress: ${error.message}`);
  }

  return (data ?? []) as LearningProgressRecord[];
}

export function progressByModuleId(rows: LearningProgressRecord[]) {
  return new Map(rows.map((row) => [row.module_id, row]));
}

export function computeOverallLearningPercent(
  modules: LearningModuleRecord[],
  progressRows: LearningProgressRecord[],
) {
  if (modules.length === 0) return 0;

  const progressMap = progressByModuleId(progressRows);
  let total = 0;

  for (const module of modules) {
    total += progressMap.get(module.id)?.percent_complete ?? 0;
  }

  return Math.round(total / modules.length);
}

export async function updateLearningProgress(input: {
  founderId: string;
  companyId: string;
  moduleId: string;
  status: LearningProgressStatus;
  percentComplete: number;
  moduleSlug?: string;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();
  const maxPercent =
    input.moduleSlug != null
      ? Math.min(100, Math.max(0, input.percentComplete))
      : Math.min(100, Math.max(0, input.percentComplete));

  const { data: existing } = await admin
    .from("learning_progress")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("module_id", input.moduleId)
    .maybeSingle();

  const payload = {
    founder_id: input.founderId,
    company_id: input.companyId,
    module_id: input.moduleId,
    status: input.status,
    percent_complete: maxPercent,
    started_at: existing?.started_at ?? (input.status !== "not_started" ? now : null),
    completed_at: input.status === "completed" ? now : existing?.completed_at ?? null,
    last_viewed_at: now,
  };

  if (existing) {
    const { data, error } = await admin
      .from("learning_progress")
      .update({
        status: payload.status,
        percent_complete: payload.percent_complete,
        started_at: payload.started_at ?? existing.started_at,
        completed_at: payload.completed_at,
        last_viewed_at: payload.last_viewed_at,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to update learning progress: ${error?.message ?? "unknown"}`);
    }

    return data as LearningProgressRecord;
  }

  const { data, error } = await admin.from("learning_progress").insert(payload).select("*").single();

  if (error || !data) {
    throw new Error(`Failed to create learning progress: ${error?.message ?? "unknown"}`);
  }

  return data as LearningProgressRecord;
}

export async function recordModuleView(input: {
  founderId: string;
  companyId: string;
  moduleId: string;
  moduleSlug: string;
  completedLessonIds: string[];
}) {
  const lessonTotal = lessonCountForSlug(input.moduleSlug) || 1;
  const percent = Math.round((input.completedLessonIds.length / lessonTotal) * 100);
  const status: LearningProgressStatus =
    percent >= 100 ? "completed" : percent > 0 ? "in_progress" : "not_started";

  return updateLearningProgress({
    founderId: input.founderId,
    companyId: input.companyId,
    moduleId: input.moduleId,
    status,
    percentComplete: percent,
    moduleSlug: input.moduleSlug,
  });
}

export async function getLearningAdminSummaryForCompanies(companyIds: string[]) {
  const map = new Map<
    string,
    { percentComplete: number; modulesEngaged: number; modulesCompleted: number }
  >();

  if (companyIds.length === 0) {
    return map;
  }

  const admin = createServiceRoleClient();
  const [{ data: progressRows }, { data: modules }] = await Promise.all([
    admin.from("learning_progress").select("company_id, status, percent_complete").in("company_id", companyIds),
    admin.from("learning_modules").select("id").eq("is_published", true),
  ]);

  const publishedCount = modules?.length ?? 0;
  const grouped = new Map<string, Array<{ status: string; percent_complete: number }>>();

  for (const row of progressRows ?? []) {
    const list = grouped.get(row.company_id) ?? [];
    list.push(row);
    grouped.set(row.company_id, list);
  }

  for (const companyId of companyIds) {
    const rows = grouped.get(companyId) ?? [];
    const modulesEngaged = rows.filter((row) => row.status !== "not_started").length;
    const modulesCompleted = rows.filter((row) => row.status === "completed").length;
    const percentComplete =
      publishedCount > 0
        ? Math.round(rows.reduce((sum, row) => sum + row.percent_complete, 0) / publishedCount)
        : 0;

    map.set(companyId, { percentComplete, modulesEngaged, modulesCompleted });
  }

  return map;
}

export async function getGlobalModuleEngagementCounts() {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("learning_progress")
    .select("module_id, status")
    .neq("status", "not_started");

  if (error) {
    throw new Error(`Failed to load module engagement: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.module_id, (counts.get(row.module_id) ?? 0) + 1);
  }

  return counts;
}
