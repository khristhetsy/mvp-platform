import "server-only";

/**
 * IR auto sequences — timed emails to one investor on one project, and alerts to the
 * account manager when the investor engages.
 *
 *   start / pause / resume / stop / markReply  — from the Share Project record
 *   runDueSequences                            — /api/cron/ir-sequences sends due steps
 *   recordEngagement                           — Resend webhook: opens and clicks on iCapOS sends
 *   onStageChanged                             — meeting stages stop the sequence and alert
 *
 * Opens and clicks are only known for iCapOS sends (Resend tags carry the enrollment and
 * step). Gmail sends are logged, but their opens can't be seen. Replies land in the
 * sender's own mailbox, so staff mark them from the record.
 */
import { createActivity, db, getMatch, getProject, updateMatch } from "@/lib/ir/db";
import { sendInvestorEmail } from "@/lib/ir/send-email";
import { sendEmail } from "@/lib/email/send-email";
import { createNotification } from "@/lib/notifications/notifications";
import { getAppUrl } from "@/lib/env";
import { fillStep, EVENT_LABEL, type AlertEvent, type SequenceEventKind, type SequenceStep, type StopEvent } from "@/lib/ir/sequence-templates";
import type { IrStage } from "@/lib/ir/types";

export type Enrollment = {
  id: string; match_id: string; project_id: string; template: string; steps: SequenceStep[]; via: "icapos" | "gmail"; include_one_pager: boolean;
  manager_id: string; watcher_ids: string[]; notify_events: AlertEvent[]; notify_email: boolean; stop_on: StopEvent[];
  status: "running" | "paused" | "stopped" | "completed"; stop_reason: string | null; next_step: number; started_at: string; next_send_at: string | null;
  last_error: string | null; created_by: string; created_at: string;
};
export type SequenceEvent = { id: string; kind: SequenceEventKind; step: number | null; detail: string | null; created_at: string };

const DAY = 86_400_000;
const at = (start: string, day: number) => new Date(new Date(start).getTime() + day * DAY).toISOString();

export async function getLiveEnrollment(matchId: string): Promise<Enrollment | null> {
  const { data } = await db().from("ir_sequence_enrollments").select("*").eq("match_id", matchId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Enrollment | null) ?? null;
}
export async function listEvents(enrollmentId: string): Promise<SequenceEvent[]> {
  const { data } = await db().from("ir_sequence_events").select("id, kind, step, detail, created_at").eq("enrollment_id", enrollmentId).order("created_at", { ascending: false }).limit(100);
  return (data ?? []) as SequenceEvent[];
}
async function logEvent(e: Enrollment, kind: SequenceEventKind, step: number | null, detail: string | null, by: string | null = null) {
  await db().from("ir_sequence_events").insert({ enrollment_id: e.id, match_id: e.match_id, kind, step, detail, created_by: by });
}
async function patch(id: string, p: Partial<Enrollment>) {
  const { error } = await db().from("ir_sequence_enrollments").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`ir sequence update: ${error.message}`);
}

export async function startSequence(input: {
  matchId: string; template: string; steps: SequenceStep[]; via: "icapos" | "gmail"; includeOnePager: boolean; skipFirst: boolean;
  managerId: string; watcherIds: string[]; notifyEvents: AlertEvent[]; notifyEmail: boolean; stopOn: StopEvent[]; by: string;
  /** Send a day-0 step right away (default). Bulk starts leave it to the next cron pass. */
  sendNow?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const match = await getMatch(input.matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found." };
  const live = await getLiveEnrollment(input.matchId);
  if (live && (live.status === "running" || live.status === "paused")) return { ok: false, status: 409, error: "This investor is already in a sequence. Stop it before starting another." };
  const steps = [...input.steps].sort((a, b) => a.day - b.day);
  const first = input.skipFirst ? 1 : 0;
  if (first >= steps.length) return { ok: false, status: 400, error: "Add at least one step after the first email." };
  const started = new Date().toISOString();
  const { data, error } = await db().from("ir_sequence_enrollments").insert({
    match_id: input.matchId, project_id: match.project_id, template: input.template, steps, via: input.via, include_one_pager: input.includeOnePager,
    manager_id: input.managerId, watcher_ids: input.watcherIds.filter((w) => w !== input.managerId), notify_events: input.notifyEvents, notify_email: input.notifyEmail,
    stop_on: input.stopOn, status: "running", next_step: first, started_at: started, next_send_at: at(started, steps[first].day), created_by: input.by,
  }).select("*").single();
  if (error) return { ok: false, status: 500, error: error.message.includes("ir_sequence_enrollments_live_idx") ? "This investor is already in a sequence." : error.message };
  const e = data as Enrollment;
  if (first === 1) await logEvent(e, "sent", 0, "Skipped: intro already sent", input.by);
  // A day-0 step goes out now rather than waiting for the next cron pass.
  if (steps[first].day === 0 && input.sendNow !== false) await sendStep(e);
  return { ok: true, id: e.id };
}

export async function controlSequence(matchId: string, action: "pause" | "resume" | "stop" | "reply", by: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const e = await getLiveEnrollment(matchId);
  if (!e || (e.status !== "running" && e.status !== "paused")) return { ok: false, status: 404, error: "No live sequence on this investor." };
  if (action === "pause") { await patch(e.id, { status: "paused" }); await logEvent(e, "paused", null, null, by); }
  if (action === "resume") {
    const next = e.steps[e.next_step];
    await patch(e.id, { status: "running", next_send_at: next ? new Date(Math.max(Date.now(), new Date(at(e.started_at, next.day)).getTime())).toISOString() : null });
    await logEvent(e, "resumed", null, null, by);
  }
  if (action === "stop") { await patch(e.id, { status: "stopped", stop_reason: "Stopped by staff", next_send_at: null }); await logEvent(e, "stopped", null, "Stopped by staff", by); }
  if (action === "reply") await engagement(e, "reply", null, "Marked as replied", by);
  return { ok: true };
}

/** Send the enrollment's next step, log it, and schedule the one after. */
async function sendStep(e: Enrollment): Promise<void> {
  const step = e.steps[e.next_step];
  if (!step) { await patch(e.id, { status: "completed", next_send_at: null }); await logEvent(e, "completed", null, null); return; }
  const match = await getMatch(e.match_id);
  const project = match ? await getProject(match.project_id) : null;
  if (!match || !project) { await patch(e.id, { status: "stopped", stop_reason: "Record removed", next_send_at: null }); return; }
  const vars = { founder: project.founder_name ?? project.title, first: (match.investor_name ?? "there").split(/\s+/)[0] };
  const { data: sender } = await db().from("profiles").select("id, email, full_name").eq("id", e.created_by).maybeSingle();
  const s = sender as { id: string; email: string | null; full_name: string | null } | null;
  const subject = fillStep(step.subject, vars), body = fillStep(step.body, vars);
  const r = await sendInvestorEmail({
    investorContactId: match.investor_contact_id, companyId: project.company_id, subject, body, via: e.via,
    includeOnePager: e.include_one_pager && e.next_step === 0, sender: { id: e.created_by, email: s?.email ?? null, name: s?.full_name ?? null },
    tags: [{ name: "ir_seq", value: e.id }, { name: "ir_step", value: String(e.next_step) }],
  });
  if (!r.ok) {
    // Pause rather than retry forever; the record shows why.
    await patch(e.id, { status: "paused", last_error: r.error });
    await logEvent(e, "failed", e.next_step, r.error);
    await alert(e, "Sequence paused", `Step ${e.next_step + 1} to ${match.investor_name ?? "the investor"} couldn't be sent: ${r.error}`, match.investor_name, project.title, null);
    return;
  }
  const now = new Date().toISOString();
  await createActivity({ projectId: project.id, matchId: match.id, taskId: match.task_id, type: "email", subject, description: body.slice(0, 4000), outcome: `Auto sequence step ${e.next_step + 1} of ${e.steps.length}, sent with ${e.via === "gmail" ? "Gmail" : "iCapOS"}`, doneAt: now, founderVisible: true, assigneeId: e.manager_id, createdBy: e.created_by });
  if (match.stage === "matched") await updateMatch(match.id, { stage: "intro_sent" }, e.created_by);
  await logEvent(e, "sent", e.next_step, subject);
  const nextIdx = e.next_step + 1, next = e.steps[nextIdx];
  if (next) await patch(e.id, { next_step: nextIdx, next_send_at: at(e.started_at, next.day), last_error: null });
  else { await patch(e.id, { next_step: nextIdx, status: "completed", next_send_at: null, last_error: null }); await logEvent(e, "completed", null, null); }
}

/** Cron: send every running step whose time has come. */
export async function runDueSequences(limit = 50): Promise<{ sent: number; failed: number }> {
  const { data } = await db().from("ir_sequence_enrollments").select("*").eq("status", "running").lte("next_send_at", new Date().toISOString()).order("next_send_at").limit(limit);
  let sent = 0, failed = 0;
  for (const e of (data ?? []) as Enrollment[]) {
    try { await sendStep(e); sent++; } catch { failed++; }
  }
  return { sent, failed };
}

/** An engagement event: log it, stop when it's a stop event, alert the manager when asked. */
async function engagement(e: Enrollment, kind: AlertEvent, step: number | null, detail: string | null, by: string | null) {
  // Opens and clicks repeat (image proxies re-fetch); record each kind once per step.
  if (kind === "open" || kind === "click") {
    const { data: seen } = await db().from("ir_sequence_events").select("id").eq("enrollment_id", e.id).eq("kind", kind).eq("step", step ?? -1).limit(1);
    if ((seen ?? []).length) return;
  }
  await logEvent(e, kind, step, detail, by);
  const stops = (kind === "reply" || kind === "meeting") && e.stop_on.includes(kind) && (e.status === "running" || e.status === "paused");
  if (stops) await patch(e.id, { status: "stopped", stop_reason: kind === "reply" ? "Investor replied" : "Meeting booked", next_send_at: null });
  if (!e.notify_events.includes(kind)) return;
  const match = await getMatch(e.match_id);
  const project = match ? await getProject(match.project_id) : null;
  const who = match?.investor_name ?? match?.investor_firm ?? "An investor";
  const what = kind === "open" ? `opened step ${(step ?? 0) + 1}` : kind === "click" ? `clicked a link in step ${(step ?? 0) + 1}` : kind === "reply" ? "replied" : "booked a meeting";
  await alert(e, `${who} ${what}`, `${who} ${what} for ${project?.founder_name ?? project?.title ?? "your founder"}.${stops ? " The sequence has stopped." : ""}`, who, project?.title ?? null, `${e.id}:${kind}:${step ?? "x"}`);
}

async function alert(e: Enrollment, title: string, message: string, _who: string | null, _project: string | null, dedupe: string | null) {
  const link = `/admin/ir/matches/${e.match_id}`;
  const recipients = [...new Set([e.manager_id, ...e.watcher_ids])];
  for (const r of recipients) {
    await createNotification({ recipientUserId: r, type: "ir_sequence_alert", title, message, entityType: "ir_match", entityId: e.match_id, deepLink: link, dedupeKey: dedupe ? `irseq:${dedupe}:${r}` : null }).catch(() => null);
  }
  if (!e.notify_email) return;
  const { data } = await db().from("profiles").select("email").in("id", recipients);
  const base = getAppUrl()?.replace(/\/$/, "") ?? "";
  for (const p of (data ?? []) as Array<{ email: string | null }>) {
    if (!p.email) continue;
    await sendEmail({ to: p.email, subject: `🔔 ${title}`, text: `${message}\n\nOpen the record: ${base}${link}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937"><p>${message.replace(/</g, "&lt;")}</p><p><a href="${base}${link}" style="color:#4338CA;font-weight:600">Open the record</a></p></div>`, source: "ir-sequence-alert" }).catch(() => false);
  }
}

/** Resend webhook: an open or click on a sequence email (tags ir_seq / ir_step). */
export async function recordEngagement(enrollmentId: string, kind: "open" | "click", step: number | null): Promise<boolean> {
  const { data } = await db().from("ir_sequence_enrollments").select("*").eq("id", enrollmentId).maybeSingle();
  if (!data) return false;
  await engagement(data as Enrollment, kind, step, null, null);
  return true;
}

/** A match moved stage: a meeting stage counts as "booked a meeting"; passed stops quietly. */
export async function onStageChanged(matchId: string, stage: IrStage, by: string): Promise<void> {
  if (stage !== "meeting_scheduled" && stage !== "meeting_held" && stage !== "committed" && stage !== "passed") return;
  const e = await getLiveEnrollment(matchId);
  if (!e || (e.status !== "running" && e.status !== "paused")) return;
  if (stage === "passed") { await patch(e.id, { status: "stopped", stop_reason: "Investor passed", next_send_at: null }); await logEvent(e, "stopped", null, "Investor passed", by); return; }
  await engagement(e, "meeting", null, stage === "meeting_scheduled" ? "Meeting scheduled" : `Stage: ${stage.replace("_", " ")}`, by);
}

export { EVENT_LABEL };
