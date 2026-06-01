import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAndComputeNextBestActions } from "@/lib/next-best-actions/compute";
import { limitNextBestActions, sortNextBestActions } from "@/lib/next-best-actions/priority";
import {
  createNotification,
  notifyStaffIfNotRecent,
} from "@/lib/notifications/notifications";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { sanitizeOperationalDescription, sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import type {
  ComputeNextBestActionsOptions,
  NextBestAction,
  NextBestActionLifecycleStatus,
  NextBestActionRecord,
  NextBestActionRole,
  NextBestActionsResult,
} from "@/lib/next-best-actions/types";
import { NBA_DISCLAIMER } from "@/lib/next-best-actions/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database, Profile } from "@/lib/supabase/types";

const ACTIVE_STATUSES = ["open", "snoozed", "overdue", "blocked", "escalated"] as const;

function parseUuid(value?: string): string | null {
  if (!value) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value) ? value : null;
}

export function buildDedupeKey(action: NextBestAction): string {
  return [
    action.role,
    action.id,
    action.entityType,
    action.entityId ?? "",
    action.sourceModule,
  ].join("|");
}

export function buildSourceSignature(action: NextBestAction): string {
  return [action.title, action.priority, action.reason, action.href].join("::");
}

function parseBlockers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean).slice(0, 10);
}

function sanitizeActionForPersistence(action: NextBestAction) {
  return {
    title: sanitizeOperationalDescription(action.title) ?? action.title.slice(0, 200),
    description: sanitizeOperationalDescription(action.description) ?? "",
    reason: sanitizeOperationalDescription(action.reason),
    blockers: parseBlockers(action.blockers),
    metadata: sanitizeOperationalMetadata({
      ...action.metadata,
      computed_id: action.id,
      created_from: action.createdFrom,
    }),
  };
}

export function suggestDueAt(action: NextBestAction): string | null {
  const now = Date.now();
  const hours = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();
  const days = (d: number) => new Date(now + d * 24 * 60 * 60 * 1000).toISOString();

  if (action.category === "compliance" && action.priority === "critical") {
    return hours(24);
  }
  if (action.id.includes("investor_documents") || action.sourceModule === "spv_requirements") {
    return hours(48);
  }
  if (action.category === "admin_review" || action.id.includes("company_review")) {
    return hours(72);
  }
  if (
    action.category === "onboarding" ||
    action.category === "readiness" ||
    action.id.includes("remediation") ||
    action.id.includes("spv_pending") ||
    action.id.includes("spv_rejected")
  ) {
    return days(7);
  }
  return null;
}

function recordToMergedAction(computed: NextBestAction | null, row: NextBestActionRecord): NextBestAction {
  const base: NextBestAction = computed ?? {
    id: row.action_type,
    role: row.role,
    title: row.title,
    description: row.description,
    priority: row.priority,
    category: row.category,
    entityType: row.entity_type ?? "system",
    entityId: row.entity_id ?? undefined,
    companyId: row.company_id ?? undefined,
    investorId: row.investor_id ?? undefined,
    spvId: row.spv_id ?? undefined,
    href: row.href,
    sourceModule: row.source_module,
    reason: row.reason ?? "",
    blockers: parseBlockers(row.blockers),
    createdFrom: String(row.metadata?.created_from ?? "persisted"),
    metadata: row.metadata ?? {},
  };

  return {
    ...base,
    persistedId: row.id,
    status: row.status,
    dueAt: row.due_at,
    snoozedUntil: row.snoozed_until,
    dismissedAt: row.dismissed_at,
    completedAt: row.completed_at,
    escalatedAt: row.escalated_at,
    urgencyAt: row.due_at ?? row.updated_at,
  };
}

export function isActionVisible(
  row: Pick<NextBestActionRecord, "status" | "snoozed_until">,
  includeInactive: boolean,
): boolean {
  if (includeInactive) {
    return ["dismissed", "completed", "snoozed", ...ACTIVE_STATUSES].includes(row.status);
  }
  if (row.status === "dismissed" || row.status === "completed") {
    return false;
  }
  if (row.status === "snoozed" && row.snoozed_until) {
    return new Date(row.snoozed_until).getTime() <= Date.now();
  }
  return ACTIVE_STATUSES.includes(row.status as (typeof ACTIVE_STATUSES)[number]);
}

export function mergeComputedWithPersistedActions(
  computed: NextBestAction[],
  persisted: NextBestActionRecord[],
  options?: { limit?: number; includeInactive?: boolean },
): NextBestAction[] {
  const includeInactive = options?.includeInactive ?? false;
  const persistedByType = new Map(persisted.map((row) => [row.action_type, row]));
  const merged: NextBestAction[] = [];
  const seen = new Set<string>();

  for (const action of computed) {
    const row = persistedByType.get(action.id);
    if (row) {
      if (!isActionVisible(row, includeInactive)) {
        continue;
      }
      merged.push(recordToMergedAction(action, row));
      seen.add(action.id);
      continue;
    }
    merged.push({ ...action, status: "open" });
    seen.add(action.id);
  }

  for (const row of persisted) {
    if (seen.has(row.action_type)) continue;
    if (!isActionVisible(row, includeInactive)) continue;
    if (!ACTIVE_STATUSES.includes(row.status as (typeof ACTIVE_STATUSES)[number]) && !includeInactive) {
      continue;
    }
    merged.push(recordToMergedAction(null, row));
  }

  return limitNextBestActions(sortNextBestActions(merged), options?.limit ?? 20);
}

async function emitLifecycleEvent(
  eventType: string,
  profile: Profile,
  row: NextBestActionRecord,
  extra?: Record<string, unknown>,
) {
  emitOperationalEvent(createServiceRoleClient(), {
    eventType,
    eventCategory: "system",
    entityType: "next_best_action",
    entityId: row.id,
    actorUserId: profile.id,
    actorRole: profile.role,
    companyId: row.company_id,
    investorId: row.investor_id,
    spvId: row.spv_id,
    severity: row.priority === "critical" ? "high" : "info",
    title: `Action ${eventType.replaceAll("_", " ")}`,
    description: null,
    metadata: sanitizeOperationalMetadata({
      action_type: row.action_type,
      category: row.category,
      priority: row.priority,
      status: row.status,
      role: row.role,
      ...extra,
    }),
    sourceModule: "next_best_actions",
    visibility: profile.role === "founder" || profile.role === "investor" ? "company_related" : "admin_only",
    dedupeKey: `${eventType}:${row.id}:${Date.now()}`,
    dedupeWindowMinutes: 1,
  });
}

export async function listUserActions(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: NextBestActionRole,
  filters?: { entityType?: string; entityId?: string; statuses?: NextBestActionLifecycleStatus[] },
) {
  let query = supabase
    .from("next_best_actions")
    .select("*")
    .eq("user_id", userId)
    .eq("role", role)
    .order("updated_at", { ascending: false });

  if (filters?.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters?.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }
  if (filters?.statuses?.length) {
    query = query.in("status", filters.statuses);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NextBestActionRecord[];
}

export async function listAdminActions(
  supabase: SupabaseClient<Database>,
  filters?: { role?: NextBestActionRole; companyId?: string; spvId?: string; limit?: number },
) {
  let query = supabase.from("next_best_actions").select("*").order("updated_at", { ascending: false });

  if (filters?.role) query = query.eq("role", filters.role);
  if (filters?.companyId) query = query.eq("company_id", filters.companyId);
  if (filters?.spvId) query = query.eq("spv_id", filters.spvId);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NextBestActionRecord[];
}

export async function markOverdueActions(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: NextBestActionRole,
) {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("next_best_actions")
    .select("id, action_type, category, priority, status, company_id, investor_id, spv_id")
    .eq("user_id", userId)
    .eq("role", role)
    .in("status", ["open", "blocked"])
    .not("due_at", "is", null)
    .lt("due_at", now);

  if (error || !rows?.length) return;

  const ids = rows.map((row) => row.id);
  await supabase
    .from("next_best_actions")
    .update({ status: "overdue", updated_at: now })
    .in("id", ids);

  for (const row of rows) {
    emitOperationalEvent(createServiceRoleClient(), {
      eventType: "next_best_action_overdue",
      eventCategory: "system",
      entityType: "next_best_action",
      entityId: row.id,
      severity: row.priority === "critical" ? "critical" : "medium",
      title: "Action overdue",
      description: null,
      metadata: sanitizeOperationalMetadata({
        action_type: row.action_type,
        category: row.category,
        priority: row.priority,
        status: "overdue",
      }),
      sourceModule: "next_best_actions",
      visibility: "admin_only",
      dedupeKey: `nba_overdue:${row.id}`,
      dedupeWindowMinutes: 60 * 24,
    });
  }
}

export async function upsertComputedActions(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  computed: NextBestAction[],
): Promise<NextBestActionRecord[]> {
  const userId = profile.id;
  const role = computed[0]?.role ?? (profile.role === "analyst" ? "analyst" : profile.role) as NextBestActionRole;
  const results: NextBestActionRecord[] = [];

  for (const action of computed) {
    const dedupeKey = buildDedupeKey(action);
    const sourceSignature = buildSourceSignature(action);
    const sanitized = sanitizeActionForPersistence(action);
    const dueAt = suggestDueAt(action);

    const { data: inactive } = await supabase
      .from("next_best_actions")
      .select("id, source_signature, status")
      .eq("user_id", userId)
      .eq("dedupe_key", dedupeKey)
      .in("status", ["dismissed", "completed"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inactive && inactive.source_signature === sourceSignature) {
      continue;
    }

    const { data: existing } = await supabase
      .from("next_best_actions")
      .select("*")
      .eq("user_id", userId)
      .eq("dedupe_key", dedupeKey)
      .in("status", [...ACTIVE_STATUSES])
      .maybeSingle();

    const payload = {
      user_id: userId,
      role: action.role,
      entity_type: action.entityType,
      entity_id: parseUuid(action.entityId),
      company_id: parseUuid(action.companyId),
      investor_id: parseUuid(action.investorId),
      spv_id: parseUuid(action.spvId),
      action_type: action.id,
      title: sanitized.title,
      description: sanitized.description,
      priority: action.priority,
      category: action.category,
      href: action.href,
      source_module: action.sourceModule,
      reason: sanitized.reason,
      blockers: sanitized.blockers,
      metadata: sanitized.metadata,
      dedupe_key: dedupeKey,
      source_signature: sourceSignature,
      due_at: dueAt,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data: updated, error } = await supabase
        .from("next_best_actions")
        .update({
          ...payload,
          status: existing.status === "overdue" ? "overdue" : existing.status,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (!error && updated) {
        results.push(updated as NextBestActionRecord);
      }
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("next_best_actions")
      .insert({
        ...payload,
        status: "open",
      })
      .select("*")
      .single();

    if (!error && inserted) {
      results.push(inserted as NextBestActionRecord);
      void emitLifecycleEvent("next_best_action_created", profile, inserted as NextBestActionRecord);
    }
  }

  return results;
}

export async function loadAndMergeNextBestActions(input: {
  profile: Profile;
  supabase: SupabaseClient<Database>;
  options?: ComputeNextBestActionsOptions;
}): Promise<NextBestActionsResult> {
  const computedResult = await loadAndComputeNextBestActions(input);
  const role = computedResult.role;
  const limit = input.options?.limit ?? 5;

  if (input.options?.sync !== false) {
    await upsertComputedActions(input.supabase, input.profile, computedResult.actions);
  }

  await markOverdueActions(input.supabase, input.profile.id, role);

  const persisted = await listUserActions(input.supabase, input.profile.id, role, {
    entityType: input.options?.entityType,
    entityId: input.options?.entityId,
  });

  const merged = mergeComputedWithPersistedActions(computedResult.actions, persisted, {
    limit,
    includeInactive: input.options?.includeInactive,
  });

  return {
    actions: merged,
    role,
    disclaimer: NBA_DISCLAIMER,
  };
}

export type LifecycleUpdateAction = "complete" | "dismiss" | "snooze" | "reopen" | "escalate";

export async function getActionById(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase.from("next_best_actions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as NextBestActionRecord | null;
}

function canManageAction(profile: Profile, row: NextBestActionRecord): boolean {
  if (profile.role === "admin" || profile.role === "analyst") {
    return true;
  }
  return row.user_id === profile.id;
}

export async function updateActionStatus(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  actionId: string,
  update: {
    action: LifecycleUpdateAction;
    snoozedUntil?: string;
    note?: string;
  },
): Promise<NextBestActionRecord> {
  const row = await getActionById(supabase, actionId);
  if (!row) {
    throw new Error("Action not found.");
  }
  if (!canManageAction(profile, row)) {
    throw new Error("Insufficient permissions.");
  }
  if (update.action === "escalate" && profile.role !== "admin" && profile.role !== "analyst") {
    throw new Error("Only staff can escalate actions.");
  }

  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["next_best_actions"]["Update"] = {
    updated_at: now,
  };

  if (update.note?.trim()) {
    patch.metadata = sanitizeOperationalMetadata({
      ...row.metadata,
      lifecycle_note: sanitizeOperationalDescription(update.note),
    });
  }

  switch (update.action) {
    case "complete":
      patch.status = "completed";
      patch.completed_at = now;
      break;
    case "dismiss":
      patch.status = "dismissed";
      patch.dismissed_at = now;
      break;
    case "snooze": {
      const until = update.snoozedUntil ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      patch.status = "snoozed";
      patch.snoozed_until = until;
      break;
    }
    case "reopen":
      patch.status = "open";
      patch.snoozed_until = null;
      patch.dismissed_at = null;
      patch.completed_at = null;
      patch.escalated_at = null;
      break;
    case "escalate":
      patch.status = "escalated";
      patch.escalated_at = now;
      break;
    default:
      throw new Error("Invalid action.");
  }

  const { data: updated, error } = await supabase
    .from("next_best_actions")
    .update(patch)
    .eq("id", actionId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(error?.message ?? "Unable to update action.");
  }

  const record = updated as NextBestActionRecord;
  const eventMap: Record<LifecycleUpdateAction, string> = {
    complete: "next_best_action_completed",
    dismiss: "next_best_action_dismissed",
    snooze: "next_best_action_snoozed",
    reopen: "next_best_action_created",
    escalate: "next_best_action_escalated",
  };
  void emitLifecycleEvent(eventMap[update.action], profile, record, { lifecycle_action: update.action });

  if (update.action === "escalate") {
    await handleEscalationNotifications(profile, record);
  }

  return record;
}

export async function completeAction(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  actionId: string,
  note?: string,
) {
  return updateActionStatus(supabase, profile, actionId, { action: "complete", note });
}

export async function dismissAction(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  actionId: string,
  note?: string,
) {
  return updateActionStatus(supabase, profile, actionId, { action: "dismiss", note });
}

export async function snoozeAction(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  actionId: string,
  snoozedUntil?: string,
  note?: string,
) {
  return updateActionStatus(supabase, profile, actionId, { action: "snooze", snoozedUntil, note });
}

export async function escalateAction(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  actionId: string,
  note?: string,
) {
  return updateActionStatus(supabase, profile, actionId, { action: "escalate", note });
}

async function handleEscalationNotifications(profile: Profile, row: NextBestActionRecord) {
  if (row.role === "founder" && row.user_id) {
    await createNotification({
      recipientUserId: row.user_id,
      actorUserId: profile.id,
      type: "next_best_action_escalated",
      title: "Action escalated",
      message: `An operational action was escalated for follow-up: ${row.title}`,
      entityType: "next_best_action",
      entityId: row.id,
    });
  }

  if (row.priority === "critical") {
    await notifyStaffIfNotRecent({
      type: "next_best_action_critical_escalated",
      title: "Critical action escalated",
      message: `Critical next best action escalated (${row.action_type}).`,
      entityType: "next_best_action",
      entityId: row.id,
      actorUserId: profile.id,
      withinHours: 4,
    });
  }
}
