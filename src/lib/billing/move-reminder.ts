import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { recordOperationalEvent } from "@/lib/monitoring/operational-events";
import { getBoolSetting } from "@/lib/settings/platform-settings";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { makeMoveLinkToken, moveLinkPath } from "@/lib/billing/move-link-core";
import { renderMoveReminderEmail } from "@/lib/billing/move-reminder-email";
import {
  DEFAULT_MOVE_REMINDER_WINDOW_DAYS,
  MOVE_REMINDER_ENABLED_KEY,
  MOVE_REMINDER_FAILED,
  MOVE_REMINDER_SENT,
  MOVE_REMINDER_WINDOW_KEY,
  MOVE_REMINDER_WOULD_SEND,
  clampWindowDays,
  evaluateMoveReminder,
  moveReminderKey,
  type MoveReminderProfile,
  type MoveReminderRecipient,
  type MoveReminderSkip,
  type MoveReminderSubscription,
} from "@/lib/billing/move-reminder-core";

const SUB_COLUMNS =
  "id, profile_id, plan_type, subscription_status, ls_subscription_id, ls_variant_id, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, grace_period_ends_at, current_period_end, monthly_price_cents";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export type MoveReminderPlan = {
  enabled: boolean;
  windowDays: number;
  /** Would be emailed on a run right now. */
  recipients: MoveReminderRecipient[];
  /** In the window and otherwise eligible, but this renewal's reminder already went out. */
  alreadySent: MoveReminderRecipient[];
  /** In the window but never emailed, with the reason. */
  skipped: Array<{ subscriptionId: string; profileId: string; reason: MoveReminderSkip }>;
};

export async function getMoveReminderWindowDays(): Promise<number> {
  try {
    const { data, error } = await loose(createServiceRoleClient())
      .from("platform_settings")
      .select("value")
      .eq("key", MOVE_REMINDER_WINDOW_KEY)
      .maybeSingle();
    if (error) return DEFAULT_MOVE_REMINDER_WINDOW_DAYS;
    const days = (data as { value?: { days?: unknown } } | null)?.value?.days;
    return days === undefined || days === null ? DEFAULT_MOVE_REMINDER_WINDOW_DAYS : clampWindowDays(days);
  } catch {
    return DEFAULT_MOVE_REMINDER_WINDOW_DAYS;
  }
}

/**
 * Who a run would email right now. Reads only: sends nothing and records nothing, so the staff
 * dry run and the job share one answer. Throws when a read fails, so a run never sends on a
 * guess (in particular, never without knowing which reminders already went out).
 */
export async function planMoveReminders(now: Date = new Date()): Promise<MoveReminderPlan> {
  const admin = loose(createServiceRoleClient());
  const [enabled, windowDays] = await Promise.all([getBoolSetting(MOVE_REMINDER_ENABLED_KEY, false), getMoveReminderWindowDays()]);
  const horizon = new Date(now.getTime() + windowDays * 86_400_000).toISOString();

  const { data: subData, error: subError } = await admin
    .from("subscriptions")
    .select(SUB_COLUMNS)
    .eq("subscription_status", "active")
    .not("ls_subscription_id", "is", null)
    .is("stripe_subscription_id", null)
    .gt("current_period_end", now.toISOString())
    .lte("current_period_end", horizon)
    .limit(1000);
  if (subError) throw new Error(`Could not read subscriptions: ${subError.message}`);
  const subs = (subData ?? []) as MoveReminderSubscription[];
  const plan: MoveReminderPlan = { enabled, windowDays, recipients: [], alreadySent: [], skipped: [] };
  if (subs.length === 0) return plan;

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .in("id", [...new Set(subs.map((s) => s.profile_id))]);
  if (profileError) throw new Error(`Could not read profiles: ${profileError.message}`);
  const profiles = new Map<string, MoveReminderProfile>();
  for (const p of (profileData ?? []) as Array<MoveReminderProfile & { id: string }>) profiles.set(p.id, p);

  const { data: sentData, error: sentError } = await admin
    .from("audit_logs")
    .select("entity_id, metadata")
    .eq("action", MOVE_REMINDER_SENT)
    .in("entity_id", subs.map((s) => s.id));
  if (sentError) throw new Error(`Could not read sent reminders: ${sentError.message}`);
  const sent = new Set<string>();
  for (const row of (sentData ?? []) as Array<{ metadata: { reminder_key?: unknown } | null }>) {
    if (typeof row.metadata?.reminder_key === "string") sent.add(row.metadata.reminder_key);
  }

  for (const sub of subs) {
    const result = evaluateMoveReminder(sub, profiles.get(sub.profile_id) ?? null, { now, windowDays });
    if ("skip" in result) {
      plan.skipped.push({ subscriptionId: sub.id, profileId: sub.profile_id, reason: result.skip });
    } else if (sent.has(moveReminderKey(result.recipient.subscriptionId, result.recipient.renewsAt))) {
      plan.alreadySent.push(result.recipient);
    } else {
      plan.recipients.push(result.recipient);
    }
  }
  return plan;
}

export type MoveReminderRun = {
  enabled: boolean;
  windowDays: number;
  due: number;
  sent: number;
  failed: number;
  wouldSend: number;
  alreadySent: number;
  skipped: number;
};

/**
 * The daily job. With the switch OFF it sends nothing and records one
 * billing.move_reminder.would_send event naming the customers. With it ON, each customer gets
 * one email per renewal, and a billing.move_reminder.sent event keyed on the subscription and
 * its renewal date stops a rerun from sending again.
 */
export async function runMoveReminders(now: Date = new Date()): Promise<MoveReminderRun> {
  const plan = await planMoveReminders(now);
  const admin = createServiceRoleClient();
  const run: MoveReminderRun = {
    enabled: plan.enabled,
    windowDays: plan.windowDays,
    due: plan.recipients.length,
    sent: 0,
    failed: 0,
    wouldSend: 0,
    alreadySent: plan.alreadySent.length,
    skipped: plan.skipped.length,
  };

  if (!plan.enabled) {
    run.wouldSend = plan.recipients.length;
    if (plan.recipients.length > 0) {
      await recordOperationalEvent(admin, {
        action: MOVE_REMINDER_WOULD_SEND,
        entityType: "subscription",
        metadata: {
          count: plan.recipients.length,
          window_days: plan.windowDays,
          profile_ids: plan.recipients.map((r) => r.profileId),
          subscription_ids: plan.recipients.map((r) => r.subscriptionId),
        },
      });
    }
    return run;
  }

  for (const r of plan.recipients) {
    const reminderKey = moveReminderKey(r.subscriptionId, r.renewsAt);
    const metadata = { reminder_key: reminderKey, profile_id: r.profileId, current_period_end: r.renewsAt, plan_type: r.plan, monthly_price_cents: r.priceCents };
    let ok = false;
    try {
      const mail = renderMoveReminderEmail({
        firstName: r.firstName,
        planLabel: PLAN_LABELS[r.plan] ?? r.plan,
        priceCents: r.priceCents,
        renewsAt: r.renewsAt,
        moveUrl: absoluteUrl(moveLinkPath(makeMoveLinkToken(r.profileId))),
      });
      ok = await sendEmail({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text, source: "billing_move_reminder", audience: "founder" });
    } catch (error) {
      console.warn("[move-reminder] send failed", error);
    }
    if (ok) {
      run.sent += 1;
      await recordOperationalEvent(admin, { action: MOVE_REMINDER_SENT, entityType: "subscription", entityId: r.subscriptionId, metadata });
    } else {
      // Not marked sent, so the next run tries again.
      run.failed += 1;
      await recordOperationalEvent(admin, { action: MOVE_REMINDER_FAILED, entityType: "subscription", entityId: r.subscriptionId, level: "warning", metadata });
    }
  }
  return run;
}
