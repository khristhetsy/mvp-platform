/**
 * Chasing activity alerts nobody opened.
 *
 * An assignment that nobody acts on is the same as no assignment, so a high or
 * critical event that has sat unread past its stage's escalation window goes to
 * the escalation target. Idempotent: `activity_event_escalations` records what
 * has already been chased, without which every run would re-escalate the same
 * event forever.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import {
  type ActivityStage,
  activityStageLabel,
  classKeyFromEventType,
  isActivityStage,
} from "@/lib/activity/stages";
import { loadStageAssignments } from "@/lib/activity/assignments";

export type EscalationPassResult = {
  considered: number;
  escalated: number;
  skippedRead: number;
  skippedNoTarget: number;
};

/** Only these ever escalate — an info-level edit does not need chasing. */
const ESCALATING_SEVERITIES = ["high", "critical"];

export async function runActivityEscalationPass(now: Date = new Date()): Promise<EscalationPassResult> {
  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const board = await loadStageAssignments();

  const policy = new Map<
    ActivityStage,
    { minutes: number | null; target: string | null; assignees: string[] }
  >();
  for (const s of board.stages) {
    policy.set(s.stage, {
      minutes: s.escalateAfterMinutes,
      target: s.escalateToUserId,
      assignees: s.userIds,
    });
  }

  // Only look back a day: an event older than that has either been handled or
  // was already escalated, and scanning further makes the pass grow forever.
  const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  const { data } = await db
    .from("operational_activity_events")
    .select("id, event_type, activity_stage, severity, title, company_id, created_at")
    .in("severity", ESCALATING_SEVERITIES)
    .not("activity_stage", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const result: EscalationPassResult = {
    considered: rows.length,
    escalated: 0,
    skippedRead: 0,
    skippedNoTarget: 0,
  };
  if (!rows.length) return result;

  const ids = rows.map((r) => String(r.id));

  const [{ data: reads }, { data: already }] = await Promise.all([
    db.from("activity_event_reads").select("event_id, user_id").in("event_id", ids),
    db.from("activity_event_escalations").select("event_id").in("event_id", ids),
  ]);

  const readBy = new Map<string, Set<string>>();
  for (const row of (reads ?? []) as Array<Record<string, unknown>>) {
    const eventId = String(row.event_id);
    if (!readBy.has(eventId)) readBy.set(eventId, new Set());
    readBy.get(eventId)!.add(String(row.user_id));
  }
  const escalatedIds = new Set(
    ((already ?? []) as Array<Record<string, unknown>>).map((r) => String(r.event_id)),
  );

  for (const row of rows) {
    const eventId = String(row.id);
    if (escalatedIds.has(eventId)) continue;

    const stageRaw = String(row.activity_stage);
    if (!isActivityStage(stageRaw)) continue;
    const stage: ActivityStage = stageRaw;

    const rule = policy.get(stage);
    if (!rule || rule.minutes === null || !rule.target) {
      result.skippedNoTarget += 1;
      continue;
    }

    const dueAt = new Date(row.created_at as string).getTime() + rule.minutes * 60_000;
    if (now.getTime() < dueAt) continue;

    // "Nobody opened it" means nobody ASSIGNED opened it. The escalation target
    // reading it early does not count as the stage having handled it.
    const readers = readBy.get(eventId) ?? new Set<string>();
    if (rule.assignees.some((id) => readers.has(id))) {
      result.skippedRead += 1;
      continue;
    }

    const classKey = classKeyFromEventType(String(row.event_type));
    await createNotification({
      recipientUserId: rule.target,
      type: "activity_escalation",
      title: `Unattended: ${String(row.title)}`,
      message: `${activityStageLabel(stage)} · nobody assigned has opened this in ${
        rule.minutes >= 60 ? `${Math.round(rule.minutes / 60)}h` : `${rule.minutes}m`
      }`,
      entityType: "operational_activity_event",
      entityId: eventId,
      severity: String(row.severity),
      deepLink: row.company_id
        ? `/admin/companies/${String(row.company_id)}`
        : `/admin/activity?event=${eventId}`,
      dedupeKey: `activity-escalation:${eventId}`,
    });

    await db.from("activity_event_escalations").insert({
      event_id: eventId,
      escalated_to: rule.target,
      escalated_at: new Date().toISOString(),
    });

    result.escalated += 1;
    void classKey;
  }

  return result;
}

/** Record that a staff member has seen an event — stops the escalation clock. */
export async function markActivityEventsRead(
  userId: string,
  eventIds: string[],
): Promise<{ error?: string }> {
  if (!eventIds.length) return {};
  const db = createServiceRoleClient() as unknown as SupabaseClient;
  const { error } = await db.from("activity_event_reads").upsert(
    eventIds.map((event_id) => ({ event_id, user_id: userId, read_at: new Date().toISOString() })),
    { onConflict: "event_id,user_id", ignoreDuplicates: true },
  );
  return { error: error?.message };
}
