/**
 * Who hears about a stage, and what happens when nobody does.
 *
 * Reads and writes `activity_stage_assignments` / `activity_stage_policies`.
 * Server-only: uses the service-role client, because staff assignment is staff
 * data and the RLS policies on those tables are read-only by design.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions, loadRbacCatalog } from "@/lib/rbac/effective-permissions";
import {
  ALL_ACTIVITY_STAGES,
  type ActivityAudience,
  type ActivityClass,
  type ActivityOverrideTarget,
  type ActivityStage,
  audienceOfStage,
  isActivityStage,
  stagesFor,
} from "@/lib/activity/stages";

/**
 * The activity tables were added after `src/lib/supabase/types.ts` was last
 * generated, so the typed client narrows them to `never`. This is the same
 * untyped escape the rest of the codebase uses for new tables; it goes away
 * when the types are regenerated.
 */
function untyped(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export type StaffMember = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isSuperAdmin: boolean;
  initials: string;
};

export type StageAssignment = {
  audience: ActivityAudience;
  stage: ActivityStage;
  userIds: string[];
  leadUserId: string | null;
  escalateAfterMinutes: number | null;
  escalateToUserId: string | null;
};

export type StageAssignmentBoard = {
  staff: StaffMember[];
  stages: StageAssignment[];
};

function initialsOf(name: string, email: string | null): string {
  const source = name.trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Staff who can actually be assigned — `regular_user` has no admin access. */
export async function listAssignableStaff(): Promise<StaffMember[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, role, is_super_admin")
    .in("role", ["admin", "analyst"])
    .eq("is_active", true)
    .order("full_name");

  return (data ?? []).map((row) => {
    const name = row.full_name?.trim() || row.email || "Unknown";
    return {
      id: row.id,
      name,
      email: row.email,
      role: row.is_super_admin ? "super_admin" : row.role,
      isSuperAdmin: Boolean(row.is_super_admin),
      initials: initialsOf(name, row.email),
    };
  });
}

async function listSuperAdminIds(): Promise<string[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("is_super_admin", true)
    .eq("is_active", true);
  return (data ?? []).map((row) => row.id);
}

function emptyStage(stage: ActivityStage): StageAssignment {
  return {
    audience: audienceOfStage(stage),
    stage,
    userIds: [],
    leadUserId: null,
    escalateAfterMinutes: null,
    escalateToUserId: null,
  };
}

/** The whole board — every stage, whether or not anybody is on it. */
export async function loadStageAssignments(): Promise<StageAssignmentBoard> {
  const admin = untyped();
  const [staff, rows, policies] = await Promise.all([
    listAssignableStaff(),
    admin
      .from("activity_stage_assignments")
      .select("audience, stage, user_id, is_lead")
      .then((r) => r.data ?? []),
    admin
      .from("activity_stage_policies")
      .select("audience, stage, escalate_after_minutes, escalate_to_user_id")
      .then((r) => r.data ?? []),
  ]);

  const byStage = new Map<ActivityStage, StageAssignment>(
    ALL_ACTIVITY_STAGES.map((stage) => [stage, emptyStage(stage)]),
  );

  for (const row of rows as Array<Record<string, unknown>>) {
    const stage = String(row.stage);
    if (!isActivityStage(stage)) continue;
    const entry = byStage.get(stage);
    if (!entry) continue;
    const userId = String(row.user_id);
    entry.userIds.push(userId);
    if (row.is_lead) entry.leadUserId = userId;
  }

  for (const row of policies as Array<Record<string, unknown>>) {
    const stage = String(row.stage);
    if (!isActivityStage(stage)) continue;
    const entry = byStage.get(stage);
    if (!entry) continue;
    entry.escalateAfterMinutes =
      row.escalate_after_minutes === null || row.escalate_after_minutes === undefined
        ? null
        : Number(row.escalate_after_minutes);
    entry.escalateToUserId = (row.escalate_to_user_id as string | null) ?? null;
  }

  return { staff, stages: ALL_ACTIVITY_STAGES.map((s) => byStage.get(s) ?? emptyStage(s)) };
}

export type SaveStageAssignmentInput = {
  audience: ActivityAudience;
  stage: ActivityStage;
  userIds: string[];
  leadUserId: string | null;
  escalateAfterMinutes?: number | null;
  escalateToUserId?: string | null;
};

/**
 * Replace one stage's assignment set.
 *
 * The lead must be one of the assignees. Saving a set that drops the current
 * lead without naming a new one leaves the stage lead-less, which the UI warns
 * about — but the write still succeeds, because refusing it would strand staff
 * who are trying to remove someone who has left.
 */
export async function saveStageAssignment(input: SaveStageAssignmentInput): Promise<{ error?: string }> {
  const admin = untyped();
  const unique = [...new Set(input.userIds)];
  const lead = input.leadUserId && unique.includes(input.leadUserId) ? input.leadUserId : null;

  // Delete-then-insert rather than upsert: the set is the unit of truth here,
  // and an upsert would leave removed people assigned.
  const { error: delError } = await admin
    .from("activity_stage_assignments")
    .delete()
    .eq("audience", input.audience)
    .eq("stage", input.stage);
  if (delError) return { error: delError.message };

  if (unique.length) {
    const { error } = await admin.from("activity_stage_assignments").insert(
      unique.map((userId) => ({
        audience: input.audience,
        stage: input.stage,
        user_id: userId,
        is_lead: userId === lead,
      })),
    );
    if (error) return { error: error.message };
  }

  if (input.escalateAfterMinutes !== undefined || input.escalateToUserId !== undefined) {
    const { error } = await admin.from("activity_stage_policies").upsert(
      {
        audience: input.audience,
        stage: input.stage,
        escalate_after_minutes: input.escalateAfterMinutes ?? null,
        escalate_to_user_id: input.escalateToUserId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "audience,stage" },
    );
    if (error) return { error: error.message };
  }

  return {};
}

/** Put one person on (or take them off) every stage of an audience in one write. */
export async function setStaffAcrossStages(input: {
  audience: ActivityAudience;
  userId: string;
  assigned: boolean;
}): Promise<{ error?: string; clearedLeads: ActivityStage[] }> {
  const admin = untyped();
  const stages = stagesFor(input.audience);

  if (!input.assigned) {
    // Removing somebody can strip a lead. Report which stages that happened on
    // so the caller can show the red state rather than silently un-leading them.
    const { data } = await admin
      .from("activity_stage_assignments")
      .select("stage")
      .eq("audience", input.audience)
      .eq("user_id", input.userId)
      .eq("is_lead", true);
    const clearedLeads = (data ?? [])
      .map((row) => String((row as Record<string, unknown>).stage))
      .filter(isActivityStage);

    const { error } = await admin
      .from("activity_stage_assignments")
      .delete()
      .eq("audience", input.audience)
      .eq("user_id", input.userId);
    return { error: error?.message, clearedLeads };
  }

  const { error } = await admin.from("activity_stage_assignments").upsert(
    stages.map((stage) => ({
      audience: input.audience,
      stage,
      user_id: input.userId,
      is_lead: false,
    })),
    { onConflict: "audience,stage,user_id", ignoreDuplicates: true },
  );
  return { error: error?.message, clearedLeads: [] };
}

export type ResolvedRecipients = {
  /** Named in the alert; the escalation clock starts from them. */
  leadUserId: string | null;
  /** Everyone who gets it, lead included. Never empty — falls back to super_admins. */
  userIds: string[];
  /** True when the stage had nobody on it and this fell back. */
  usedFallback: boolean;
  overrides: ActivityOverrideTarget[];
};

/**
 * Who to tell about one event.
 *
 * Stage owners, plus the class's override targets (Compliance, CEO) which are
 * firm risk rather than stage work. A stage with nobody assigned falls back to
 * every super_admin — an unassigned stage must be loud, not silent.
 */
export async function resolveRecipients(
  stage: ActivityStage,
  cls: Pick<ActivityClass, "overrides">,
): Promise<ResolvedRecipients> {
  const admin = untyped();
  const audience = audienceOfStage(stage);

  const { data } = await admin
    .from("activity_stage_assignments")
    .select("user_id, is_lead")
    .eq("audience", audience)
    .eq("stage", stage);

  const rows = (data ?? []) as Array<{ user_id: string; is_lead: boolean }>;
  const overrides = cls.overrides ?? [];

  if (!rows.length) {
    const fallback = await listSuperAdminIds();
    return { leadUserId: null, userIds: fallback, usedFallback: true, overrides };
  }

  const ids = rows.map((r) => r.user_id);
  const lead = rows.find((r) => r.is_lead)?.user_id ?? null;

  // Override targets are resolved by permission rather than by a named seat, so
  // a departure does not silently empty them.
  if (overrides.length) {
    const extra = await resolveOverrideRecipients(overrides);
    for (const id of extra) if (!ids.includes(id)) ids.push(id);
  }

  return { leadUserId: lead, userIds: ids, usedFallback: false, overrides };
}

/**
 * Override targets are resolved by permission, not by a named seat, so somebody
 * leaving does not silently empty the compliance list.
 *
 * There is no flat user→permission table — permissions come from the internal
 * role plus per-user overrides — so this walks staff through
 * `getEffectivePermissions` with the RBAC catalog loaded once. That is a handful
 * of queries, which is affordable because only high and critical classes carry
 * overrides; it is cached for a minute so a burst of events does not repeat it.
 */
const OVERRIDE_CACHE_MS = 60_000;
let complianceCache: { at: number; ids: string[] } | null = null;

async function complianceRecipients(): Promise<string[]> {
  if (complianceCache && Date.now() - complianceCache.at < OVERRIDE_CACHE_MS) {
    return complianceCache.ids;
  }

  const admin = createServiceRoleClient();
  const staff = await listAssignableStaff();
  const catalog = await loadRbacCatalog(admin as unknown as Parameters<typeof loadRbacCatalog>[0]);

  const ids: string[] = [];
  for (const member of staff) {
    const { permissions } = await getEffectivePermissions(
      admin as unknown as Parameters<typeof getEffectivePermissions>[0],
      member.id,
      { role: member.role as never, is_super_admin: member.isSuperAdmin },
      catalog,
    );
    if (permissions.includes("manage_compliance")) ids.push(member.id);
  }

  // Never resolve to nobody — an unrouted compliance alert is the failure this
  // whole design exists to avoid.
  const resolved = ids.length ? ids : await listSuperAdminIds();
  complianceCache = { at: Date.now(), ids: resolved };
  return resolved;
}

async function resolveOverrideRecipients(targets: ActivityOverrideTarget[]): Promise<string[]> {
  const ids: string[] = [];
  if (targets.includes("ceo")) ids.push(...(await listSuperAdminIds()));
  if (targets.includes("compliance")) ids.push(...(await complianceRecipients()));
  return [...new Set(ids)];
}
