import type { SupabaseClient } from "@supabase/supabase-js";
import { tabToStatuses } from "@/lib/actions/filters";
import type {
  ActionCenterAnalytics,
  ActionCenterDetail,
  ActionCenterFilters,
  ActionCenterListResult,
  ActionTimelineItem,
  BulkActionType,
} from "@/lib/actions/types";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import {
  loadAndMergeNextBestActions,
  markOverdueActions,
  recordToDisplayAction,
  updateActionStatus,
} from "@/lib/next-best-actions/lifecycle";
import type {
  NextBestAction,
  NextBestActionLifecycleStatus,
  NextBestActionRecord,
  NextBestActionRole,
} from "@/lib/next-best-actions/types";
import { compareNextBestActions } from "@/lib/next-best-actions/priority";
import type { Database, Profile } from "@/lib/supabase/types";
import { actionCenterBasePath } from "@/lib/actions/filters";
import { needsAttentionGroup } from "@/lib/notifications/orchestration/hints";
import { runNotificationOrchestrationForProfile } from "@/lib/notifications/orchestration/orchestrator";
import { summarizeActions } from "@/lib/notifications/orchestration/summaries";

function roleForProfile(profile: Profile): NextBestActionRole {
  if (profile.role === "investor") return "investor";
  if (profile.role === "admin") return "admin";
  if (profile.role === "analyst") return "analyst";
  return "founder";
}

function isOverdueRow(row: Pick<NextBestActionRecord, "status" | "due_at">): boolean {
  if (row.status === "overdue") return true;
  if (!row.due_at) return false;
  if (!["open", "snoozed", "blocked"].includes(row.status)) return false;
  return new Date(row.due_at).getTime() < Date.now();
}

function matchesSearch(row: NextBestActionRecord, q?: string): boolean {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return [row.title, row.description, row.reason, row.action_type, row.category]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function matchesTab(row: NextBestActionRecord, tab: ActionCenterFilters["tab"]): boolean {
  if (tab === "snoozed") {
    return row.status === "snoozed" && Boolean(row.snoozed_until && new Date(row.snoozed_until) > new Date());
  }
  if (tab === "overdue") {
    return isOverdueRow(row);
  }
  if (tab === "active") {
    if (row.status === "snoozed" && row.snoozed_until && new Date(row.snoozed_until) > new Date()) {
      return false;
    }
    return ["open", "blocked", "escalated"].includes(row.status);
  }
  const statuses = tabToStatuses(tab);
  return statuses ? statuses.includes(row.status) : true;
}

function applyFilters(rows: NextBestActionRecord[], filters: ActionCenterFilters): NextBestActionRecord[] {
  return rows.filter((row) => {
    if (filters.assignedToMe !== false && filters.status && row.status !== filters.status) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.entityType && row.entity_type !== filters.entityType) return false;
    if (filters.companyId && row.company_id !== filters.companyId) return false;
    if (filters.investorId && row.investor_id !== filters.investorId) return false;
    if (filters.spvId && row.spv_id !== filters.spvId) return false;
    if (filters.overdue && !isOverdueRow(row)) return false;
    if (filters.escalated && row.status !== "escalated") return false;
    if (!matchesTab(row, filters.tab)) return false;
    if (!matchesSearch(row, filters.q)) return false;
    return true;
  });
}

export function computeActionAnalytics(
  rows: NextBestActionRecord[],
  role: NextBestActionRole,
): ActionCenterAnalytics {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCategory: Record<string, number> = {};

  let open = 0;
  let overdue = 0;
  let escalated = 0;
  let completedThisWeek = 0;
  let completedToday = 0;
  let critical = 0;
  let blocked = 0;
  let snoozed = 0;
  let readinessImpact = 0;
  let pendingRequirements = 0;

  for (const row of rows) {
    byPriority[row.priority as keyof typeof byPriority] += 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;

    if (["open", "blocked", "escalated"].includes(row.status)) open += 1;
    if (isOverdueRow(row)) overdue += 1;
    if (row.status === "escalated") escalated += 1;
    if (row.status === "blocked") blocked += 1;
    if (row.status === "snoozed") snoozed += 1;
    if (row.priority === "critical" && row.status !== "completed" && row.status !== "dismissed") {
      critical += 1;
    }

    if (row.status === "completed" && row.completed_at) {
      const completedAt = new Date(row.completed_at).getTime();
      if (completedAt >= weekAgo) completedThisWeek += 1;
      if (completedAt >= dayStart.getTime()) completedToday += 1;
    }

    if (role === "founder" && ["readiness", "remediation"].some((part) => row.action_type.includes(part))) {
      if (row.status !== "completed" && row.status !== "dismissed") readinessImpact += 1;
    }
    if (role === "investor" && row.category === "spv" && row.status !== "completed") {
      pendingRequirements += 1;
    }
  }

  return {
    open,
    overdue,
    escalated,
    completedThisWeek,
    completedToday,
    critical,
    blocked,
    snoozed,
    byPriority,
    byCategory,
    readinessImpact: role === "founder" ? readinessImpact : undefined,
    pendingRequirements: role === "investor" ? pendingRequirements : undefined,
    activeOpportunities:
      role === "investor"
        ? rows.filter((r) => r.category === "investor_engagement" && r.status !== "completed").length
        : undefined,
  };
}

async function fetchPersistedRows(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  role: NextBestActionRole,
) {
  let query = supabase.from("next_best_actions").select("*").eq("role", role).order("updated_at", { ascending: false });

  if (profile.role === "founder" || profile.role === "investor") {
    query = query.eq("user_id", profile.id);
  } else {
    query = query.eq("user_id", profile.id);
  }

  const { data, error } = await query.limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as NextBestActionRecord[];
}

export async function loadActionCenter(input: {
  profile: Profile;
  supabase: SupabaseClient<Database>;
  filters: ActionCenterFilters;
  sync?: boolean;
}): Promise<ActionCenterListResult> {
  const role = roleForProfile(input.profile);
  const basePath = actionCenterBasePath(input.profile.role);

  if (input.sync !== false) {
    await loadAndMergeNextBestActions({
      profile: input.profile,
      supabase: input.supabase,
      options: { role, limit: 20, sync: true, includeInactive: true },
    });
  }

  await markOverdueActions(input.supabase, input.profile.id, role);

  if (input.sync !== false) {
    void runNotificationOrchestrationForProfile(input.supabase, input.profile, role).catch(() => undefined);
  }

  const rows = await fetchPersistedRows(input.supabase, input.profile, role);
  const filtered = applyFilters(rows, input.filters);
  const sorted = filtered
    .map((row) => recordToDisplayAction(null, row))
    .sort(compareNextBestActions);

  const total = sorted.length;
  const page = sorted.slice(input.filters.offset, input.filters.offset + input.filters.limit);
  const analytics = computeActionAnalytics(rows, role);
  const orchestration = summarizeActions(rows);
  const attention = needsAttentionGroup(sorted).slice(0, 8);

  return {
    actions: page,
    needsAttention: attention,
    total,
    analytics,
    orchestration: {
      overdueCount: orchestration.overdueCount,
      escalatedCount: orchestration.escalatedCount,
      blockedCount: orchestration.blockedCount,
      stalledCount: orchestration.stalledCount,
      needsAttentionCount: orchestration.needsAttentionCount,
    },
    role,
    basePath,
  };
}

export function resolveWorkspaceHref(action: NextBestAction, role: NextBestActionRole): string | null {
  if (action.companyId && (role === "admin" || role === "analyst")) {
    return `/admin/companies/${action.companyId}`;
  }
  if (action.spvId && (role === "admin" || role === "analyst")) {
    return `/admin/spvs`;
  }
  return action.href || null;
}

export async function loadActionCenterDetail(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  actionId: string,
): Promise<ActionCenterDetail | null> {
  const { data: row, error } = await supabase.from("next_best_actions").select("*").eq("id", actionId).maybeSingle();
  if (error || !row) return null;

  const record = row as NextBestActionRecord;
  if (profile.role === "founder" || profile.role === "investor") {
    if (record.user_id !== profile.id) return null;
  }

  const role = record.role as NextBestActionRole;
  const action = recordToDisplayAction(null, record);

  const feed = await getOperationalActivityFeed(supabase, {
    limit: 20,
    companyId: record.company_id ?? undefined,
    spvId: record.spv_id ?? undefined,
  }).catch(() => ({ items: [] }));

  const lifecycleTypes = new Set([
    "next_best_action_created",
    "next_best_action_completed",
    "next_best_action_dismissed",
    "next_best_action_snoozed",
    "next_best_action_escalated",
    "next_best_action_overdue",
    "workflow_overdue_detected",
    "workflow_escalated",
    "workflow_inactivity_detected",
    "reminder_generated",
    "digest_generated",
  ]);

  const timeline: ActionTimelineItem[] = feed.items
    .filter(
      (item) =>
        item.entity_id === actionId ||
        lifecycleTypes.has(item.event_type) ||
        String(item.metadata?.action_type ?? "") === record.action_type,
    )
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      event_type: item.event_type,
      title: item.title,
      created_at: item.created_at,
      severity: item.severity,
      category: item.event_category,
    }));

  return {
    action,
    workspaceHref: resolveWorkspaceHref(action, role),
    timeline,
  };
}

export async function bulkUpdateActions(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  actionIds: string[],
  operation: BulkActionType,
  options?: { snoozedUntil?: string },
) {
  const results: NextBestActionRecord[] = [];
  for (const id of actionIds.slice(0, 25)) {
    const row = await updateActionStatus(supabase, profile, id, {
      action: operation,
      snoozedUntil: options?.snoozedUntil,
    });
    results.push(row);
  }
  return results;
}
