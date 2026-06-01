import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { detectWorkflowInactivity } from "@/lib/notifications/orchestration/inactivity";
import { ORCHESTRATION_SCAN_LIMIT } from "@/lib/notifications/orchestration/rules";
import { listStaffProfileIds } from "@/lib/notifications/notifications";
import { digestCadenceForType, shouldRunCadence } from "@/lib/notifications/scheduled/cadence";
import {
  buildAdminScheduledDigest,
  buildComplianceAttentionDigest,
  buildCriticalOverdueDigest,
  buildFounderScheduledDigest,
  buildInvestorScheduledDigest,
  buildSpvBlockerDigest,
} from "@/lib/notifications/scheduled/digest-builders";
import { deliverDigestReadyNotification, getLastDigestRunAt, persistScheduledDigest } from "@/lib/notifications/scheduled/digest-history";
import { deliverScheduledReminders } from "@/lib/notifications/scheduled/reminder-delivery";
import { scanRemindersFromActions } from "@/lib/notifications/scheduled/reminder-triggers";
import type { ScheduledDigest, ScheduledDigestPassResult, ScheduledDigestType } from "@/lib/notifications/scheduled/types";
import { markOverdueActions } from "@/lib/next-best-actions/lifecycle";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import type { Database } from "@/lib/supabase/types";

const ACTIVE_STATUSES = ["open", "overdue", "blocked", "escalated", "snoozed"] as const;

async function fetchActiveActions(supabase: SupabaseClient<Database>): Promise<NextBestActionRecord[]> {
  const { data, error } = await supabase
    .from("next_best_actions")
    .select("*")
    .in("status", [...ACTIVE_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(ORCHESTRATION_SCAN_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []) as NextBestActionRecord[];
}

async function emitDigestGenerated(digest: ScheduledDigest, userId: string | null) {
  const admin = createServiceRoleClient();
  emitOperationalEvent(admin, {
    eventType: "scheduled_digest_generated",
    eventCategory: "system",
    entityType: "scheduled_digest",
    entityId: null,
    relatedUserId: userId,
    severity: digest.counts.critical > 0 ? "critical" : digest.counts.overdue > 0 ? "high" : "info",
    title: digest.title.slice(0, 120),
    description: null,
    metadata: sanitizeOperationalMetadata({
      digest_type: digest.digestType,
      item_count: digest.counts.total,
      attention_areas: digest.attentionAreas,
    }),
    sourceModule: "scheduled_digests",
    visibility: userId ? "company_related" : "admin_only",
    dedupeKey: `digest_gen:${digest.digestType}:${userId ?? "platform"}:${digest.generatedAt.slice(0, 10)}`,
    dedupeWindowMinutes: 60 * 12,
  });
}

async function maybePersistDigest(
  supabase: SupabaseClient<Database>,
  digest: ScheduledDigest,
  force: boolean,
): Promise<{ runId: string | null; skipped: boolean }> {
  const cadence = digestCadenceForType(digest.digestType);
  const lastAt = await getLastDigestRunAt(supabase, digest.digestType, digest.userId);
  if (!shouldRunCadence(lastAt, cadence, { force }) || digest.counts.total === 0) {
    return { runId: null, skipped: true };
  }

  const runId = await persistScheduledDigest(supabase, digest);
  if (!runId) return { runId: null, skipped: true };

  await emitDigestGenerated(digest, digest.userId ?? null);
  return { runId, skipped: false };
}

export async function runScheduledDigestPass(
  supabase: SupabaseClient<Database>,
  options?: { force?: boolean },
): Promise<ScheduledDigestPassResult> {
  const force = options?.force ?? false;
  const rows = await fetchActiveActions(supabase);

  const uniqueUsers = new Map<string, { userId: string; role: NextBestActionRecord["role"] }>();
  for (const row of rows) {
    if (row.user_id && (row.role === "founder" || row.role === "investor")) {
      uniqueUsers.set(`${row.role}:${row.user_id}`, { userId: row.user_id, role: row.role });
    }
    if (row.user_id) {
      await markOverdueActions(supabase, row.user_id, row.role).catch(() => undefined);
    }
  }

  const inactivityFindings = await detectWorkflowInactivity(supabase);
  const inactivityTitles = inactivityFindings.map((f) => f.title).slice(0, 8);

  const reminders = scanRemindersFromActions(rows);
  const reminderResult = await deliverScheduledReminders(reminders);

  const runs: ScheduledDigestPassResult["runs"] = [];
  let digestsGenerated = 0;
  let notificationsCreated = reminderResult.sent;

  const platformDigests: ScheduledDigest[] = [
    buildAdminScheduledDigest(rows, inactivityTitles),
    buildCriticalOverdueDigest(rows),
    buildSpvBlockerDigest(rows),
    buildComplianceAttentionDigest(rows),
  ];

  const staffIds = await listStaffProfileIds();

  for (const digest of platformDigests) {
    const { runId, skipped } = await maybePersistDigest(supabase, digest, force);
    if (!skipped && runId) {
      digestsGenerated += 1;
      runs.push({ digestType: digest.digestType, runId, userId: null, itemCount: digest.counts.total });
      for (const staffId of staffIds) {
        await deliverDigestReadyNotification(supabase, digest, staffId);
        notificationsCreated += 1;
      }
    }
  }

  for (const { userId, role } of uniqueUsers.values()) {
    const digest =
      role === "founder"
        ? buildFounderScheduledDigest(rows, userId, inactivityTitles)
        : buildInvestorScheduledDigest(rows, userId, inactivityTitles);

    const { runId, skipped } = await maybePersistDigest(supabase, digest, force);
    if (!skipped && runId) {
      digestsGenerated += 1;
      runs.push({ digestType: digest.digestType, runId, userId, itemCount: digest.counts.total });
      await deliverDigestReadyNotification(supabase, digest, userId);
      notificationsCreated += 1;
    }
  }

  return {
    digestsGenerated,
    remindersSent: reminderResult.sent,
    remindersSkipped: reminderResult.skipped,
    notificationsCreated,
    eventsEmitted: reminderResult.eventsEmitted + digestsGenerated,
    runs,
  };
}

export async function getDigestTypesForRole(role: string): Promise<ScheduledDigestType[]> {
  if (role === "founder") return ["founder_weekly_digest"];
  if (role === "investor") return ["investor_weekly_digest"];
  return ["admin_daily_digest", "critical_overdue_digest", "spv_blocker_digest", "compliance_attention_digest"];
}
