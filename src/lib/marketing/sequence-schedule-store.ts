/**
 * Server side of sequence scheduled sends: read and save schedules, batch review
 * actions (review, hold, reschedule), and the cron runner that releases pending
 * batches at their scheduled time and sends the review reminder beforehand.
 */
import "server-only";
import { marketingDb } from "./db";
import { collectDueSequenceBatches, getPendingBatches, releaseSequenceBatch, type PendingBatch } from "./sequences";
import {
  describeSchedule, formatPt, formatTime, latestRun, nextRuns, REPEAT_RULES,
  type RepeatRule, type SequenceSchedule,
} from "./sequence-schedule";
import { createNotification, listStaffProfileIds } from "@/lib/notifications/notifications";

const SCHEDULE_COLS =
  "sequence_id, enabled, start_date, end_date, repeat, weekdays, send_time, max_per_run, reminder_minutes, unreviewed_action, activated_at, last_run_for, run_sent, run_done, last_reminder_for";

export async function getSchedules(): Promise<SequenceSchedule[]> {
  const { data } = await marketingDb().from("marketing_sequence_schedules").select(SCHEDULE_COLS);
  return (data ?? []) as SequenceSchedule[];
}

export async function getSchedule(sequenceId: string): Promise<SequenceSchedule | null> {
  const { data } = await marketingDb().from("marketing_sequence_schedules").select(SCHEDULE_COLS).eq("sequence_id", sequenceId).maybeSingle();
  return (data as SequenceSchedule | null) ?? null;
}

export type ScheduleInput = {
  enabled: boolean;
  start_date: string;
  end_date: string | null;
  repeat: RepeatRule;
  weekdays: number[];
  send_time: string;
  max_per_run: number;
  reminder_minutes: number;
  unreviewed_action: "send" | "hold";
};

export function validateScheduleInput(i: ScheduleInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.start_date)) return "Pick a start date.";
  if (i.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(i.end_date)) return "The end date isn't valid.";
  if (i.end_date && i.end_date < i.start_date) return "The end date is before the start date.";
  if (!REPEAT_RULES.includes(i.repeat)) return "Pick a repeat option.";
  if (i.repeat === "weekly" && i.weekdays.length === 0) return "Pick at least one day for weekly.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.send_time)) return "Pick a send time.";
  if (!Number.isInteger(i.max_per_run) || i.max_per_run < 1 || i.max_per_run > 5000) return "Max sends per run must be 1 to 5,000.";
  return null;
}

/** Save (create or replace). Restarts the run state so a run time already passed today isn't caught up. */
export async function saveSchedule(sequenceId: string, i: ScheduleInput, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await marketingDb().from("marketing_sequence_schedules").upsert({
    sequence_id: sequenceId,
    enabled: i.enabled,
    start_date: i.start_date,
    end_date: i.end_date || null,
    repeat: i.repeat,
    weekdays: [...new Set(i.weekdays)].filter((d) => d >= 0 && d <= 6),
    send_time: i.send_time,
    max_per_run: i.max_per_run,
    reminder_minutes: Math.max(0, Math.round(i.reminder_minutes)),
    unreviewed_action: i.unreviewed_action,
    activated_at: now,
    last_run_for: null,
    run_sent: 0,
    run_done: false,
    last_reminder_for: null,
    updated_by: userId,
    updated_at: now,
  }, { onConflict: "sequence_id" });
  if (error) throw new Error(error.message);
}

export async function deleteSchedule(sequenceId: string): Promise<void> {
  const { error } = await marketingDb().from("marketing_sequence_schedules").delete().eq("sequence_id", sequenceId);
  if (error) throw new Error(error.message);
}

// ---------- Pending batches with their send time ----------

export type ScheduledBatch = PendingBatch & {
  reviewed_at: string | null;
  on_hold: boolean;
  send_after: string | null;
  /** When it sends next (ISO), or null if it won't send on its own. */
  send_at: string | null;
  /** "scheduled" (sequence schedule), "custom" (rescheduled), "hold", "waiting_review", "sending", "manual" (no schedule). */
  send_state: "scheduled" | "custom" | "hold" | "waiting_review" | "sending" | "manual";
  schedule_label: string | null;
  reminder_at: string | null;
};

export async function getScheduledPendingBatches(now: Date = new Date()): Promise<ScheduledBatch[]> {
  const batches = await getPendingBatches();
  if (batches.length === 0) return [];
  const db = marketingDb();
  const [{ data: extra }, schedules] = await Promise.all([
    db.from("marketing_sequence_batches").select("id, reviewed_at, on_hold, send_after").in("id", batches.map((b) => b.id)),
    getSchedules(),
  ]);
  const ex = new Map(((extra ?? []) as { id: string; reviewed_at: string | null; on_hold: boolean; send_after: string | null }[]).map((r) => [r.id, r]));
  const sched = new Map(schedules.map((s) => [s.sequence_id, s]));

  return batches.map((b) => {
    const e = ex.get(b.id);
    const s = sched.get(b.sequence_id);
    const base = {
      ...b,
      reviewed_at: e?.reviewed_at ?? null,
      on_hold: e?.on_hold ?? false,
      send_after: e?.send_after ?? null,
      schedule_label: s ? describeSchedule(s) : null,
      reminder_at: null as string | null,
    };
    if (base.on_hold) return { ...base, send_at: null, send_state: "hold" as const };
    if (base.send_after && new Date(base.send_after) > now) return { ...base, send_at: base.send_after, send_state: "custom" as const };
    if (!s || !s.enabled) return { ...base, send_at: null, send_state: "manual" as const };
    if (s.unreviewed_action === "hold" && !base.reviewed_at) return { ...base, send_at: nextRuns(s, now, 1)[0]?.toISOString() ?? null, send_state: "waiting_review" as const };
    const cur = latestRun(s, now);
    if (cur && cur >= new Date(s.activated_at) && !(s.last_run_for && new Date(s.last_run_for).getTime() === cur.getTime() && s.run_done)) {
      return { ...base, send_at: cur.toISOString(), send_state: "sending" as const };
    }
    const next = nextRuns(s, now, 1)[0] ?? null;
    const reminder = next && s.reminder_minutes > 0 ? new Date(next.getTime() - s.reminder_minutes * 60_000).toISOString() : null;
    return { ...base, send_at: next?.toISOString() ?? null, send_state: "scheduled" as const, reminder_at: reminder };
  });
}

// ---------- Batch actions ----------

export async function markBatchReviewed(batchId: string, userId: string): Promise<void> {
  const { error } = await marketingDb().from("marketing_sequence_batches")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq("id", batchId).eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function setBatchHold(batchId: string, onHold: boolean): Promise<void> {
  const { error } = await marketingDb().from("marketing_sequence_batches").update({ on_hold: onHold }).eq("id", batchId).eq("status", "pending");
  if (error) throw new Error(error.message);
}

/** A one off send time for this batch (null goes back to the sequence schedule). */
export async function setBatchSendAfter(batchId: string, at: string | null): Promise<void> {
  const { error } = await marketingDb().from("marketing_sequence_batches").update({ send_after: at, on_hold: false }).eq("id", batchId).eq("status", "pending");
  if (error) throw new Error(error.message);
}

export type BatchPreview = {
  subject: string | null;
  html_body: string | null;
  from_name: string | null;
  from_email: string | null;
  recipients: { email: string; name: string; company: string | null }[];
  total: number;
};

export async function getBatchPreview(batchId: string): Promise<BatchPreview> {
  const db = marketingDb();
  const { data: batch } = await db.from("marketing_sequence_batches").select("step_id").eq("id", batchId).maybeSingle();
  if (!batch) throw new Error("Batch not found.");
  const [{ data: step }, { data: rows, count }] = await Promise.all([
    db.from("marketing_sequence_steps").select("from_name, from_email, template:marketing_templates(subject, html_body)").eq("id", batch.step_id).maybeSingle(),
    db.from("marketing_sequence_enrollments").select("contact:marketing_contacts(email, first_name, last_name, company)", { count: "exact" })
      .eq("batch_id", batchId).eq("status", "awaiting_approval").limit(200),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const st = step as any;
  const tpl = Array.isArray(st?.template) ? st.template[0] : st?.template;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipients = ((rows ?? []) as any[]).map((r) => (Array.isArray(r.contact) ? r.contact[0] : r.contact)).filter(Boolean)
    .map((c) => ({ email: c.email as string, name: [c.first_name, c.last_name].filter(Boolean).join(" "), company: (c.company as string | null) ?? null }));
  return { subject: tpl?.subject ?? null, html_body: tpl?.html_body ?? null, from_name: st?.from_name ?? null, from_email: st?.from_email ?? null, recipients, total: count ?? recipients.length };
}

// ---------- Cron runner ----------

type RunResult = { reminders: number; runs: number; sent: number; failed: number; oneOff: number; pendingCollected: number };

export async function runSequenceSchedules(now: Date = new Date(), budgetMs = 240_000): Promise<RunResult> {
  const started = Date.now();
  const timeLeft = () => budgetMs - (Date.now() - started);
  const db = marketingDb();
  const out: RunResult = { reminders: 0, runs: 0, sent: 0, failed: 0, oneOff: 0, pendingCollected: 0 };

  const { data } = await db.from("marketing_sequence_schedules").select(`${SCHEDULE_COLS}, updated_by`).eq("enabled", true);
  const schedules = (data ?? []) as (SequenceSchedule & { updated_by: string | null })[];

  const due = schedules
    .map((s) => ({ s, run: latestRun(s, now) }))
    .filter((x): x is { s: (typeof schedules)[number]; run: Date } =>
      !!x.run && x.run >= new Date(x.s.activated_at) &&
      !(x.s.last_run_for && new Date(x.s.last_run_for).getTime() === x.run.getTime() && x.s.run_done));

  const { data: oneOffRows } = await db.from("marketing_sequence_batches").select("id")
    .eq("status", "pending").eq("on_hold", false).not("send_after", "is", null).lte("send_after", now.toISOString());
  const oneOff = (oneOffRows ?? []) as { id: string }[];

  // Fresh batches first, so a run picks up contacts that came due since the hourly collector.
  if (due.length > 0 || oneOff.length > 0) {
    const c = await collectDueSequenceBatches().catch(() => ({ batches: 0, queued: 0 }));
    out.pendingCollected = c.queued;
  }

  // Batches moved to a one off time: send them fully.
  for (const b of oneOff) {
    let prev = -1;
    while (timeLeft() > 20_000) {
      const r = await releaseSequenceBatch(b.id, null, 50);
      out.sent += r.sent; out.failed += r.failed;
      if (r.remaining === 0 || r.remaining === prev) break;
      prev = r.remaining;
    }
    out.oneOff++;
  }

  // Scheduled runs: up to max_per_run per sequence per run.
  for (const { s, run } of due) {
    if (timeLeft() < 20_000) break;
    let sent = s.run_sent;
    if (!s.last_run_for || new Date(s.last_run_for).getTime() !== run.getTime()) {
      sent = 0;
      await db.from("marketing_sequence_schedules").update({ last_run_for: run.toISOString(), run_sent: 0, run_done: false }).eq("sequence_id", s.sequence_id);
    }
    let q = db.from("marketing_sequence_batches").select("id")
      .eq("sequence_id", s.sequence_id).eq("status", "pending").eq("on_hold", false)
      .or(`send_after.is.null,send_after.lte.${now.toISOString()}`)
      .order("created_at", { ascending: true });
    if (s.unreviewed_action === "hold") q = q.not("reviewed_at", "is", null);
    const { data: rows } = await q;

    let outOfTime = false;
    for (const b of (rows ?? []) as { id: string }[]) {
      let prev = -1;
      while (sent < s.max_per_run) {
        if (timeLeft() < 20_000) { outOfTime = true; break; }
        const r = await releaseSequenceBatch(b.id, s.updated_by, Math.min(50, s.max_per_run - sent));
        sent += r.sent + r.failed; out.sent += r.sent; out.failed += r.failed;
        if (r.remaining === 0 || r.remaining === prev) break;
        prev = r.remaining;
      }
      if (outOfTime || sent >= s.max_per_run) break;
    }
    await db.from("marketing_sequence_schedules").update({ run_sent: sent, run_done: !outOfTime }).eq("sequence_id", s.sequence_id);
    out.runs++;
  }

  // Review reminders before the next run.
  for (const s of schedules) {
    if (s.reminder_minutes <= 0) continue;
    const next = nextRuns(s, now, 1)[0];
    if (!next) continue;
    if (next.getTime() - s.reminder_minutes * 60_000 > now.getTime()) continue;
    if (s.last_reminder_for && new Date(s.last_reminder_for).getTime() === next.getTime()) continue;

    const { data: waiting } = await db.from("marketing_sequence_batches").select("id, will_send_count")
      .eq("sequence_id", s.sequence_id).eq("status", "pending").eq("on_hold", false).is("reviewed_at", null).is("send_after", null);
    const list = (waiting ?? []) as { id: string; will_send_count: number }[];
    await db.from("marketing_sequence_schedules").update({ last_reminder_for: next.toISOString() }).eq("sequence_id", s.sequence_id);
    if (list.length === 0) continue;

    const { data: seq } = await db.from("marketing_sequences").select("name, approver_id").eq("id", s.sequence_id).maybeSingle();
    const recipients = seq?.approver_id ? [seq.approver_id as string] : await listStaffProfileIds();
    const emails = list.reduce((a, b) => a + (b.will_send_count ?? 0), 0);
    const title = `Review before ${formatTime(s.send_time)} PT: ${seq?.name ?? "Sequence"}`;
    const message = `${emails.toLocaleString()} ${emails === 1 ? "email" : "emails"} send ${formatPt(next)}. ` +
      (s.unreviewed_action === "send" ? "They go out even if not reviewed." : "They wait until you review them.");
    await Promise.all(recipients.map((recipientUserId) => createNotification({
      recipientUserId, type: "sequence_send_reminder", title, message,
      entityType: "marketing_sequence", entityId: s.sequence_id, severity: "info",
      deepLink: "/admin/sales/sequences", dedupeKey: `seq-reminder:${s.sequence_id}:${next.toISOString()}`,
    })));
    out.reminders++;
  }

  return out;
}

