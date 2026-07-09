import { createServiceRoleClient } from "@/lib/supabase/admin";
import { awardModuleScorePoints } from "@/lib/learning/score-impact";
import { computeStageCompletionPercent } from "@/lib/learning/stage-access";
import { computeOverallLearningPercent, progressByModuleId } from "@/lib/learning/progress-utils";
import { lessonCountForSlug } from "@/lib/learning/modules";

export { computeOverallLearningPercent, progressByModuleId };
import { createNotification } from "@/lib/notifications/notifications";
import type {
  LearningAtRiskFounder,
  LearningBadgeCriteriaType,
  LearningBadgeRecord,
  LearningLeaderboardEntry,
  LearningModuleRecord,
  LearningProgressRecord,
  LearningProgressStatus,
  LearningUserBadgeRecord,
} from "@/lib/learning/types";

// The aggregate RPCs (migration 20260708008) aren't in the generated Supabase
// types yet, so call them through a narrow cast rather than `any`.
type AggregateRpc = <T>(fn: string) => Promise<{ data: T[] | null; error: { message?: string } | null }>;

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
    const wasAlreadyCompleted = existing.status === "completed";
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

    if (input.status === "completed" && !wasAlreadyCompleted) {
      if (input.moduleSlug) {
        await awardModuleScorePoints({
          companyId: input.companyId,
          moduleSlug: input.moduleSlug,
          wasAlreadyCompleted: false,
        });
      }
      await checkCapitalReadyMilestone(input.founderId, input.companyId);
    }

    return data as LearningProgressRecord;
  }

  const { data, error } = await admin.from("learning_progress").insert(payload).select("*").single();

  if (error || !data) {
    throw new Error(`Failed to create learning progress: ${error?.message ?? "unknown"}`);
  }

  if (input.status === "completed") {
    if (input.moduleSlug) {
      await awardModuleScorePoints({
        companyId: input.companyId,
        moduleSlug: input.moduleSlug,
        wasAlreadyCompleted: false,
      });
    }
    await checkCapitalReadyMilestone(input.founderId, input.companyId);
  }

  return data as LearningProgressRecord;
}

const CAPITAL_READY_STAGES = ["foundation", "readiness", "capital", "engagement"] as const;

async function checkCapitalReadyMilestone(founderId: string, companyId: string) {
  const admin = createServiceRoleClient();
  const [{ data: company }, { data: modules }, { data: progressRows }, { data: capitalBadge }] = await Promise.all([
    admin.from("companies").select("capital_ready_at, founder_id").eq("id", companyId).maybeSingle(),
    admin.from("learning_modules").select("*").eq("is_published", true),
    admin
      .from("learning_progress")
      .select("*")
      .eq("founder_id", founderId)
      .eq("company_id", companyId),
    admin.from("learning_badges").select("id").eq("icon_name", "capital-ready").maybeSingle(),
  ]);

  if (!company || company.capital_ready_at) return;

  const publishedModules = (modules ?? []) as LearningModuleRecord[];
  const progress = (progressRows ?? []) as LearningProgressRecord[];

  const stagesComplete = CAPITAL_READY_STAGES.every(
    (stage) => computeStageCompletionPercent(stage, publishedModules, progress) >= 80,
  );

  if (!stagesComplete) return;

  const now = new Date().toISOString();
  await admin.from("companies").update({ capital_ready_at: now, updated_at: now }).eq("id", companyId);

  if (capitalBadge?.id) {
    const { data: existingAward } = await admin
      .from("learning_user_badges")
      .select("id")
      .eq("founder_id", founderId)
      .eq("company_id", companyId)
      .eq("badge_id", capitalBadge.id)
      .maybeSingle();

    if (!existingAward) {
      await admin.from("learning_user_badges").insert({
        founder_id: founderId,
        company_id: companyId,
        badge_id: capitalBadge.id,
        earned_at: now,
      });
    }
  }

  void createNotification({
    recipientUserId: founderId,
    type: "learning_milestone",
    title: "Capital Ready",
    message:
      "Congratulations — you completed foundation through engagement learning stages. You are Capital Ready for institutional outreach on iCapOS.",
    entityType: "company",
    entityId: companyId,
  });
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

function computeActivityStreakDays(activityTimestamps: string[]) {
  if (activityTimestamps.length === 0) return 0;

  const daySet = new Set(activityTimestamps.map((timestamp) => timestamp.slice(0, 10)));
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const offset = daySet.has(todayKey) ? 0 : 1;

  let streak = 0;
  for (let i = offset; i < 400; i += 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i);
    const key = day.toISOString().slice(0, 10);
    if (!daySet.has(key)) break;
    streak += 1;
  }

  return streak;
}

/** Real consecutive-day study streak for a founder, from lesson + module activity. */
export async function getFounderStudyStreak(founderId: string, companyId: string): Promise<number> {
  const admin = createServiceRoleClient();
  const [{ data: lessonProgress }, { data: moduleProgress }] = await Promise.all([
    admin
      .from("founder_lesson_progress")
      .select("completed_at, last_viewed_at")
      .eq("founder_id", founderId)
      .eq("company_id", companyId),
    admin
      .from("learning_progress")
      .select("last_viewed_at")
      .eq("founder_id", founderId)
      .eq("company_id", companyId),
  ]);

  const activityTimestamps: string[] = [];
  for (const row of lessonProgress ?? []) {
    if (row.last_viewed_at) activityTimestamps.push(row.last_viewed_at);
    if (row.completed_at) activityTimestamps.push(row.completed_at);
  }
  for (const row of moduleProgress ?? []) {
    if (row.last_viewed_at) activityTimestamps.push(row.last_viewed_at);
  }

  return computeActivityStreakDays(activityTimestamps);
}

export async function checkAndAwardBadges(founderId: string, companyId: string) {
  const admin = createServiceRoleClient();
  const [{ data: badges }, { data: earned }, { data: moduleProgress }, { data: lessonProgress }, { data: quizAttempts }] =
    await Promise.all([
      admin.from("learning_badges").select("*"),
      admin.from("learning_user_badges").select("badge_id").eq("founder_id", founderId).eq("company_id", companyId),
      admin
        .from("learning_progress")
        .select("status, last_viewed_at")
        .eq("founder_id", founderId)
        .eq("company_id", companyId),
      admin
        .from("founder_lesson_progress")
        .select("status, completed_at, last_viewed_at")
        .eq("founder_id", founderId)
        .eq("company_id", companyId),
      admin
        .from("founder_quiz_attempts")
        .select("passed")
        .eq("founder_id", founderId)
        .eq("company_id", companyId)
        .eq("passed", true),
    ]);

  const earnedSet = new Set((earned ?? []).map((row) => row.badge_id));
  const activityTimestamps: string[] = [];

  for (const row of lessonProgress ?? []) {
    if (row.last_viewed_at) activityTimestamps.push(row.last_viewed_at);
    if (row.completed_at) activityTimestamps.push(row.completed_at);
  }
  for (const row of moduleProgress ?? []) {
    if (row.last_viewed_at) activityTimestamps.push(row.last_viewed_at);
  }

  const stats: Record<LearningBadgeCriteriaType, number> = {
    modules_completed: (moduleProgress ?? []).filter((row) => row.status === "completed").length,
    lessons_completed: (lessonProgress ?? []).filter((row) => row.status === "completed").length,
    quiz_passed: (quizAttempts ?? []).length,
    streak_days: computeActivityStreakDays(activityTimestamps),
  };

  const now = new Date().toISOString();
  const newlyAwarded: LearningUserBadgeRecord[] = [];

  for (const badge of (badges ?? []) as LearningBadgeRecord[]) {
    if (earnedSet.has(badge.id)) continue;
    if (stats[badge.criteria_type] < badge.criteria_value) continue;

    const { data, error } = await admin
      .from("learning_user_badges")
      .insert({
        founder_id: founderId,
        company_id: companyId,
        badge_id: badge.id,
        earned_at: now,
      })
      .select("*")
      .single();

    if (!error && data) {
      newlyAwarded.push(data as LearningUserBadgeRecord);
    }
  }

  await checkCapitalReadyMilestone(founderId, companyId);

  return newlyAwarded;
}

type AtRiskCompanyRow = {
  id: string;
  company_name: string;
  founder_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

/**
 * Per-company most-recent learning activity as epoch ms. Fast path uses the
 * server-side aggregate RPC (migration 20260708008); the fallback scans the three
 * progress tables but is bounded to the candidate companies via `.in()`.
 */
async function loadLastActivityByCompany(
  admin: ReturnType<typeof createServiceRoleClient>,
  companyIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const bump = (companyId: string | null, iso: string | null) => {
    if (!companyId || !iso) return;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && t > (map.get(companyId) ?? 0)) map.set(companyId, t);
  };

  const rpc = admin.rpc as unknown as AggregateRpc;
  const agg = await rpc<{ company_id: string; last_activity: string | null }>("learning_company_last_activity");
  if (!agg.error && agg.data) {
    for (const row of agg.data) bump(row.company_id, row.last_activity);
    return map;
  }

  // Fallback (RPC not yet migrated): bounded scan.
  const [{ data: progressRows }, { data: lessonRows }, { data: courseProgressRows }] = await Promise.all([
    admin.from("learning_progress").select("company_id, last_viewed_at").in("company_id", companyIds),
    admin.from("founder_lesson_progress").select("company_id, last_viewed_at, completed_at").in("company_id", companyIds),
    admin.from("learning_course_progress").select("company_id, last_viewed_at").in("company_id", companyIds),
  ]);
  for (const row of progressRows ?? []) bump(row.company_id, row.last_viewed_at);
  for (const row of lessonRows ?? []) { bump(row.company_id, row.last_viewed_at); bump(row.company_id, row.completed_at); }
  for (const row of courseProgressRows ?? []) bump(row.company_id, row.last_viewed_at);
  return map;
}

export async function getLearningAtRiskFounders(inactivityDays = 7) {
  const admin = createServiceRoleClient();
  const { data: rawCompanies, error } = await admin
    .from("companies")
    .select("id, company_name, founder_id, profiles:founder_id(full_name, email)")
    .not("founder_id", "is", null);

  const companies = (rawCompanies ?? []) as AtRiskCompanyRow[];

  if (error || companies.length === 0) {
    return [] as LearningAtRiskFounder[];
  }

  const companyIds = companies.map((company) => company.id);
  const [lastActivityByCompany, summaries] = await Promise.all([
    loadLastActivityByCompany(admin, companyIds),
    getLearningAdminSummaryForCompanies(companyIds),
  ]);

  const now = Date.now();
  const msPerDay = 86_400_000;
  const cutoff = now - inactivityDays * msPerDay;
  const atRisk: LearningAtRiskFounder[] = [];

  for (const company of companies) {
    if (!company.founder_id) continue;

    const lastMs = lastActivityByCompany.get(company.id) ?? 0;
    const lastActivityAt = lastMs > 0 ? new Date(lastMs).toISOString() : null;

    if (lastMs >= cutoff && lastMs > 0) continue;

    const summary = summaries.get(company.id) ?? {
      percentComplete: 0,
      modulesEngaged: 0,
      modulesCompleted: 0,
    };
    const profile = company.profiles as { full_name?: string | null; email?: string | null } | null;

    atRisk.push({
      companyId: company.id,
      companyName: company.company_name,
      founderId: company.founder_id,
      founderName: profile?.full_name ?? null,
      founderEmail: profile?.email ?? null,
      daysInactive: lastActivityAt ? Math.floor((now - lastMs) / msPerDay) : inactivityDays + 1,
      lastActivityAt,
      percentComplete: summary.percentComplete,
      modulesEngaged: summary.modulesEngaged,
      modulesCompleted: summary.modulesCompleted,
    });
  }

  atRisk.sort((a, b) => b.daysInactive - a.daysInactive);
  return atRisk;
}

type LeaderboardCompanyRow = {
  id: string;
  company_name: string;
  industry: string | null;
  profiles: { full_name: string | null } | null;
};

export async function getLeaderboard(companyId: string) {
  const admin = createServiceRoleClient();

  type Stat = { modulesCompleted: number; sumPercent: number; badges: number };
  const stats = new Map<string, Stat>();

  // Fast path: per-company stats via the aggregate RPC (migration 20260708008).
  const rpc = admin.rpc as unknown as AggregateRpc;
  const [statsRes, { data: modules }] = await Promise.all([
    rpc<{ company_id: string; modules_completed: number; sum_percent: number; badges: number }>("learning_leaderboard_stats"),
    admin.from("learning_modules").select("id").eq("is_published", true),
  ]);
  const publishedCount = modules?.length ?? 0;

  if (!statsRes.error && statsRes.data) {
    for (const r of statsRes.data) {
      stats.set(r.company_id, { modulesCompleted: Number(r.modules_completed), sumPercent: Number(r.sum_percent), badges: Number(r.badges) });
    }
  } else {
    // Fallback (RPC not yet migrated): scan + group in JS.
    const [{ data: progressRows }, { data: badgeRows }] = await Promise.all([
      admin.from("learning_progress").select("company_id, status, percent_complete"),
      admin.from("learning_user_badges").select("company_id"),
    ]);
    const badgeCounts = new Map<string, number>();
    for (const row of badgeRows ?? []) badgeCounts.set(row.company_id, (badgeCounts.get(row.company_id) ?? 0) + 1);
    for (const row of progressRows ?? []) {
      const s = stats.get(row.company_id) ?? { modulesCompleted: 0, sumPercent: 0, badges: 0 };
      if (row.status === "completed") s.modulesCompleted += 1;
      s.sumPercent += row.percent_complete;
      stats.set(row.company_id, s);
    }
    for (const [cid, s] of stats) s.badges = badgeCounts.get(cid) ?? 0;
  }

  const companyIds = [...new Set([...stats.keys(), companyId])];
  if (companyIds.length === 0) {
    return [] as LearningLeaderboardEntry[];
  }

  const { data: rawCompanies } = await admin
    .from("companies")
    .select("id, company_name, industry, profiles:founder_id(full_name)")
    .in("id", companyIds);

  const companyMap = new Map(((rawCompanies ?? []) as LeaderboardCompanyRow[]).map((company) => [company.id, company]));

  const scored = companyIds
    .map((id) => {
      const company = companyMap.get(id);
      if (!company) return null;

      const s = stats.get(id) ?? { modulesCompleted: 0, sumPercent: 0, badges: 0 };
      const overallPercent = publishedCount > 0 ? Math.round(s.sumPercent / publishedCount) : 0;

      return {
        companyId: id,
        companyName: company.company_name,
        founderFirstName: company.profiles?.full_name?.split(/\s+/)[0] ?? null,
        industry: company.industry,
        overallPercent,
        modulesCompleted: s.modulesCompleted,
        badgesEarned: s.badges,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  scored.sort((a, b) => {
    if (b.overallPercent !== a.overallPercent) return b.overallPercent - a.overallPercent;
    if (b.modulesCompleted !== a.modulesCompleted) return b.modulesCompleted - a.modulesCompleted;
    return b.badgesEarned - a.badgesEarned;
  });

  return scored.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isCurrentCompany: entry.companyId === companyId,
  }));
}

export async function getGlobalModuleEngagementCounts() {
  const admin = createServiceRoleClient();

  // Fast path: server-side aggregation (migration 20260708008).
  const rpc = admin.rpc as unknown as AggregateRpc;
  const agg = await rpc<{ module_id: string; cnt: number }>("learning_module_engagement_counts");
  if (!agg.error && agg.data) {
    const counts = new Map<string, number>();
    for (const row of agg.data) counts.set(row.module_id, Number(row.cnt));
    return counts;
  }

  // Fallback (RPC not yet migrated): scan.
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
