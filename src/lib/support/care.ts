/**
 * Support care: what happens around a request so the founder feels looked
 * after and nothing sits unanswered.
 *
 * - New request: promised reply time, staff notified (assigned person plus the
 *   notify list), founder confirmation naming the owner and the time.
 * - Replies: staff reply emails the founder; founder reply notifies staff.
 * - Scheduled pass (every 15 minutes): staff reminders until resolved, a
 *   "due in 2 hours" alert, an escalation plus an honest "more time" note to the
 *   founder when the promise is missed, a nudge when the founder owes a reply,
 *   and the "did this solve it?" reminder (day 2) and close (day 7).
 * - Every step is written to support_events (the Support log).
 *
 * Service role throughout: these run from routes, `after()` and the cron.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification, listStaffProfileIds } from "@/lib/notifications/notifications";
import { addBusinessHours, isBusinessTime } from "./business-hours";
import { getSupportSettings, type SupportCareSettings } from "./settings";
import { logSupportEvent } from "./events";
import {
  closedEmail,
  confirmationEmail,
  deliverSupportEmail,
  moreTimeEmail,
  resolvedEmail,
  staffAlertEmail,
  staffReplyEmail,
  waitingOnYouEmail,
  type FounderEmailCtx,
  type StaffEmailKind,
} from "./emails";
import { REQUEST_COLS, founderSupportLink, staffSupportLink, type SupportRequest } from "./support";

/* eslint-disable @typescript-eslint/no-explicit-any */
function svc(): SupabaseClient<any> {
  return createServiceRoleClient() as unknown as SupabaseClient<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Founder owes a reply this long before a nudge. */
const NUDGE_AFTER_MS = 2 * DAY;
/** "Did this solve it?" reminder, then auto close. */
const CONFIRM_REMINDER_MS = 2 * DAY;
const AUTO_CLOSE_MS = 7 * DAY;
/** Staff get a heads up this long before the promised reply time. */
const DUE_SOON_MS = 2 * HOUR;

type Person = { id: string; name: string; email: string | null };

export type RequestCtx = {
  request: SupportRequest;
  companyName: string | null;
  founder: Person | null;
  owner: Person | null;
  firstMessage: string | null;
  lastStaffMessage: string | null;
};

async function loadPeople(ids: string[]): Promise<Map<string, Person>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data } = await svc().from("profiles").select("id, full_name, email").in("id", uniq);
  return new Map(
    ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [
      p.id,
      { id: p.id, name: p.full_name?.trim() || p.email || "Staff", email: p.email },
    ]),
  );
}

export async function loadRequestCtx(requestId: string): Promise<RequestCtx | null> {
  const { data } = await svc().from("support_requests").select(REQUEST_COLS).eq("id", requestId).maybeSingle();
  const request = data as SupportRequest | null;
  if (!request) return null;
  const [{ data: company }, people, { data: msgs }] = await Promise.all([
    svc().from("companies").select("company_name").eq("id", request.company_id).maybeSingle(),
    loadPeople([request.founder_id, request.assigned_to ?? ""]),
    svc()
      .from("support_messages")
      .select("author_role, body, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);
  const rows = (msgs ?? []) as Array<{ author_role: string; body: string }>;
  return {
    request,
    companyName: (company as { company_name: string | null } | null)?.company_name ?? null,
    founder: people.get(request.founder_id) ?? null,
    owner: request.assigned_to ? people.get(request.assigned_to) ?? null : null,
    firstMessage: rows.find((m) => m.author_role === "founder")?.body ?? null,
    lastStaffMessage: [...rows].reverse().find((m) => m.author_role === "staff")?.body ?? null,
  };
}

function founderCtx(c: RequestCtx): FounderEmailCtx {
  return {
    requestId: c.request.id,
    refNo: c.request.ref_no,
    subject: c.request.subject,
    founderName: c.founder?.name ?? null,
    ownerName: c.owner?.name ?? null,
  };
}

function openFor(createdAt: string, now = Date.now()): string {
  const h = Math.floor((now - new Date(createdAt).getTime()) / HOUR);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${Math.max(0, h)}h`;
}

async function patch(requestId: string, values: Record<string, unknown>): Promise<void> {
  await svc().from("support_requests").update(values).eq("id", requestId);
}

// ── Staff notifications ─────────────────────────────────────────────────

const STAFF_TYPE: Record<StaffEmailKind, string> = {
  new: "support_request_new",
  founder_reply: "support_founder_reply",
  reminder: "support_reminder",
  due_soon: "support_due_soon",
  overdue: "support_overdue",
};

function staffTitle(kind: StaffEmailKind, c: RequestCtx, recipientIsOwner: boolean): string {
  switch (kind) {
    case "new":
      return recipientIsOwner ? "New support request assigned to you" : "New founder support request";
    case "founder_reply":
      return "Founder replied on a support request";
    case "reminder":
      return `Still open: ${c.request.subject}`;
    case "due_soon":
      return `Reply due in 2 hours: ${c.request.subject}`;
    case "overdue":
      return `Promised reply time missed: ${c.request.subject}`;
  }
}

/**
 * Notify staff about a request. The assigned person is always notified (bell
 * and email, unless they're on the list, where their own choices apply). The
 * notify list joins for the events it's switched on for. Nobody gets the same
 * alert twice. With no owner and no list, the first staff are notified, as before.
 */
export async function notifyStaffAbout(
  c: RequestCtx,
  kind: StaffEmailKind,
  opts: { settings?: SupportCareSettings; message?: string | null } = {},
): Promise<string[]> {
  const settings = opts.settings ?? (await getSupportSettings());
  const listOn = kind === "new" ? settings.notifyOnNew : kind === "founder_reply" ? settings.notifyOnFounderReply : true;

  const targets = new Map<string, { inApp: boolean; email: boolean }>();
  if (listOn) for (const r of settings.recipients) targets.set(r.userId, { inApp: r.inApp, email: r.email });
  const ownerId = c.request.assigned_to;
  if (ownerId && !targets.has(ownerId)) targets.set(ownerId, { inApp: true, email: true });
  if (targets.size === 0 && kind === "new") {
    for (const id of (await listStaffProfileIds()).slice(0, 5)) targets.set(id, { inApp: true, email: false });
  }
  if (targets.size === 0) return [];

  const people = await loadPeople([...targets.keys()]);
  const message = opts.message ?? (kind === "new" ? c.firstMessage : null);
  const link = staffSupportLink(c.request.id);
  const notified: string[] = [];

  await Promise.all(
    [...targets.entries()].map(async ([userId, how]) => {
      let reached = false;
      if (how.inApp) {
        const n = await createNotification({
          recipientUserId: userId,
          type: STAFF_TYPE[kind],
          title: staffTitle(kind, c, userId === ownerId),
          message: `${c.companyName ?? "A founder"}: ${c.request.subject}`,
          entityType: "company",
          entityId: c.request.company_id,
          deepLink: link,
          severity: kind === "overdue" || kind === "due_soon" ? "high" : null,
        });
        reached = reached || Boolean(n);
      }
      if (how.email) {
        const sent = await deliverSupportEmail({
          to: people.get(userId)?.email,
          userId,
          type: STAFF_TYPE[kind],
          deepLink: link,
          requestId: c.request.id,
          email: staffAlertEmail({
            kind,
            requestId: c.request.id,
            refNo: c.request.ref_no,
            subject: c.request.subject,
            companyName: c.companyName,
            founderName: c.founder?.name ?? null,
            ownerName: c.owner?.name ?? null,
            message,
            dueAt: c.request.due_at,
            openFor: kind === "new" ? null : openFor(c.request.created_at),
          }),
        });
        reached = reached || sent;
      }
      if (reached) notified.push(people.get(userId)?.name ?? "Staff");
    }),
  );
  return notified;
}

// ── New request ─────────────────────────────────────────────────────────

/** Fast part, run before responding: set the promised reply time. */
export async function setPromisedReply(requestId: string, settings?: SupportCareSettings): Promise<string | null> {
  const s = settings ?? (await getSupportSettings());
  const dueAt = addBusinessHours(new Date(), s.replyTargetHours).toISOString();
  await patch(requestId, { due_at: dueAt });
  return dueAt;
}

/** Slow part, run after responding: log, notify staff, confirm to the founder, AI triage. */
export async function finishNewRequest(requestId: string, via: "form" | "assistant"): Promise<void> {
  const settings = await getSupportSettings();
  const c = await loadRequestCtx(requestId);
  if (!c) return;

  await logSupportEvent({
    requestId,
    founderId: c.request.founder_id,
    actor: "founder",
    actorUserId: c.request.founder_id,
    kind: "submitted",
    summary: `${c.founder?.name ?? "Founder"} submitted the request`,
    detail: c.firstMessage,
    meta: { via, source: c.request.source, topic: c.request.context_item },
  });
  if (c.owner) {
    await logSupportEvent({
      requestId,
      founderId: c.request.founder_id,
      actor: "system",
      kind: "assigned",
      summary: `Auto assigned to ${c.owner.name}`,
      meta: { assignee: c.owner.id, rule: "least open requests" },
    });
  }

  const notified = await notifyStaffAbout(c, "new", { settings });
  if (notified.length) {
    await logSupportEvent({
      requestId,
      founderId: c.request.founder_id,
      actor: "system",
      kind: "staff_notified",
      summary: "Staff notified",
      detail: notified.join(", "),
    });
  }

  if (c.founder) {
    const sent = await deliverSupportEmail({
      to: c.founder.email,
      userId: c.founder.id,
      type: "support_confirmation",
      deepLink: founderSupportLink(requestId),
      requestId,
      email: confirmationEmail(founderCtx(c), c.firstMessage, c.request.due_at),
    });
    await logSupportEvent({
      requestId,
      founderId: c.request.founder_id,
      actor: "system",
      kind: "confirmation_sent",
      summary: sent ? "Confirmation emailed to founder" : "Confirmation shown in the app (email not sent)",
      meta: { dueAt: c.request.due_at },
    });
  }

  if (settings.ai.triage) {
    const { triageRequest } = await import("./ai");
    await triageRequest(requestId).catch(() => {});
  }
}

// ── Replies, assignment, resolve ────────────────────────────────────────

export async function onFounderReply(requestId: string, body: string): Promise<void> {
  const c = await loadRequestCtx(requestId);
  if (!c) return;
  await logSupportEvent({
    requestId,
    founderId: c.request.founder_id,
    actor: "founder",
    actorUserId: c.request.founder_id,
    kind: "founder_reply",
    summary: `${c.founder?.name ?? "Founder"} replied`,
    detail: body,
  });
  const notified = await notifyStaffAbout(c, "founder_reply", { message: body });
  if (notified.length) {
    await logSupportEvent({ requestId, founderId: c.request.founder_id, actor: "system", kind: "staff_notified", summary: "Staff notified of the reply", detail: notified.join(", ") });
  }
}

/**
 * Staff replied. Clears the promised time (it's been kept), records the first
 * reply, emails the founder, and notes whether an AI draft was sent as is.
 */
export async function onStaffReply(requestId: string, staffId: string, body: string, aiDraft: string | null): Promise<void> {
  const c = await loadRequestCtx(requestId);
  if (!c) return;
  const now = new Date().toISOString();
  await patch(requestId, {
    due_at: null,
    due_soon_alerted_at: null,
    ...(c.request.first_staff_reply_at ? {} : { first_staff_reply_at: now }),
  });

  const people = await loadPeople([staffId]);
  const staffName = people.get(staffId)?.name ?? "Staff";
  const draftUse = aiDraft ? (aiDraft.trim() === body.trim() ? "unedited" : "edited") : null;
  await logSupportEvent({
    requestId,
    founderId: c.request.founder_id,
    actor: "staff",
    actorUserId: staffId,
    kind: "staff_reply",
    summary:
      draftUse === "unedited"
        ? `${staffName} sent the AI draft unedited`
        : draftUse === "edited"
          ? `${staffName} edited the AI draft and sent it`
          : `${staffName} replied`,
    detail: body,
    meta: { aiDraft: draftUse, firstReply: !c.request.first_staff_reply_at },
  });

  if (c.founder) {
    const ctx = { ...founderCtx(c), ownerName: staffName };
    const sent = await deliverSupportEmail({
      to: c.founder.email,
      userId: c.founder.id,
      type: "support_staff_reply",
      deepLink: founderSupportLink(requestId),
      requestId,
      email: staffReplyEmail(ctx, body),
    });
    await logSupportEvent({
      requestId,
      founderId: c.request.founder_id,
      actor: "system",
      kind: "founder_notified",
      summary: sent ? "Founder notified by bell and email" : "Founder notified by bell",
    });
  }
}

export async function onAssigned(requestId: string, assigneeId: string | null, byStaffId: string): Promise<void> {
  const people = await loadPeople([assigneeId ?? "", byStaffId]);
  await logSupportEvent({
    requestId,
    actor: "staff",
    actorUserId: byStaffId,
    kind: "reassigned",
    summary: assigneeId
      ? `${people.get(byStaffId)?.name ?? "Staff"} assigned it to ${assigneeId === byStaffId ? "themself" : people.get(assigneeId)?.name ?? "staff"}`
      : `${people.get(byStaffId)?.name ?? "Staff"} unassigned it`,
  });
}

export async function onResolved(requestId: string, staffId: string, summary: string | null, aiSummary: string | null): Promise<void> {
  const c = await loadRequestCtx(requestId);
  if (!c) return;
  const people = await loadPeople([staffId]);
  const staffName = people.get(staffId)?.name ?? "Staff";
  const summaryUse = aiSummary && summary ? (aiSummary.trim() === summary.trim() ? "unedited" : "edited") : null;
  await logSupportEvent({
    requestId,
    founderId: c.request.founder_id,
    actor: "staff",
    actorUserId: staffId,
    kind: "resolved",
    summary: `${staffName} clicked Resolve`,
    detail: summary,
    meta: { aiSummary: summaryUse, openFor: openFor(c.request.created_at) },
  });
  if (c.founder) {
    const sent = await deliverSupportEmail({
      to: c.founder.email,
      userId: c.founder.id,
      type: "support_resolved",
      deepLink: founderSupportLink(requestId),
      requestId,
      email: resolvedEmail({ ...founderCtx(c), ownerName: c.owner?.name ?? staffName }, summary),
    });
    await logSupportEvent({
      requestId,
      founderId: c.request.founder_id,
      actor: "system",
      kind: "confirm_sent",
      summary: sent ? 'Sent "Did this solve your issue?" email' : 'Founder asked "Did this solve your issue?" in the app',
    });
  }
}

// ── Founder confirms, reopens, rates ────────────────────────────────────

export async function founderConfirm(
  requestId: string,
  solved: boolean,
  via: "email" | "app",
): Promise<{ ok: true; status: string; changed: boolean; alreadySolved: boolean } | { error: string }> {
  const c = await loadRequestCtx(requestId);
  if (!c) return { error: "Request not found." };
  const now = new Date().toISOString();

  if (solved) {
    if (c.request.status !== "resolved") return { ok: true, status: c.request.status, changed: false, alreadySolved: false };
    if (c.request.csat === 1) return { ok: true, status: "resolved", changed: false, alreadySolved: true };
    await patch(requestId, { csat: 1, closed_at: now, updated_at: now });
    await logSupportEvent({
      requestId,
      founderId: c.request.founder_id,
      actor: "founder",
      actorUserId: c.request.founder_id,
      kind: "founder_confirmed",
      summary: "Founder confirmed it's solved",
      meta: { via },
    });
    return { ok: true, status: "resolved", changed: true, alreadySolved: false };
  }

  // Not solved: reopen with the same owner at top priority.
  if (c.request.status !== "resolved") return { ok: true, status: c.request.status, changed: false, alreadySolved: false };
  {
    const settings = await getSupportSettings();
    const dueAt = addBusinessHours(new Date(), Math.max(1, Math.round(settings.replyTargetHours / 2))).toISOString();
    await patch(requestId, {
      status: "open",
      priority: "high",
      csat: -1,
      resolved_at: null,
      closed_at: null,
      confirm_reminded_at: null,
      reopened_count: (c.request.reopened_count ?? 0) + 1,
      due_at: dueAt,
      due_soon_alerted_at: null,
      updated_at: now,
    });
    await logSupportEvent({
      requestId,
      founderId: c.request.founder_id,
      actor: "founder",
      actorUserId: c.request.founder_id,
      kind: "founder_reopened",
      summary: "Founder said it's not solved. Reopened at top priority",
      meta: { via, dueAt },
    });
    if (c.request.assigned_to) {
      await createNotification({
        recipientUserId: c.request.assigned_to,
        type: "support_csat_negative",
        title: "A founder says their issue isn't solved",
        message: `${c.companyName ?? "A founder"}: ${c.request.subject}. Reopened at top priority.`,
        entityType: "company",
        entityId: c.request.company_id,
        deepLink: staffSupportLink(requestId),
        severity: "high",
      });
    }
  }
  return { ok: true, status: "open", changed: true, alreadySolved: false };
}

export async function founderRate(requestId: string, rating: number, comment: string | null): Promise<{ ok: true } | { error: string }> {
  const c = await loadRequestCtx(requestId);
  if (!c) return { error: "Request not found." };
  const r = Math.min(5, Math.max(1, Math.round(rating)));
  await patch(requestId, { rating: r, rating_comment: comment?.trim() ? comment.trim().slice(0, 1000) : null, updated_at: new Date().toISOString() });
  await logSupportEvent({
    requestId,
    founderId: c.request.founder_id,
    actor: "founder",
    actorUserId: c.request.founder_id,
    kind: "rated",
    summary: `Founder rated support ${r} of 5`,
    detail: comment?.trim() || null,
    meta: { rating: r },
  });
  if (r <= 2 && c.request.assigned_to) {
    await createNotification({
      recipientUserId: c.request.assigned_to,
      type: "support_csat_negative",
      title: `A founder rated support ${r} of 5`,
      message: c.request.subject,
      entityType: "company",
      entityId: c.request.company_id,
      deepLink: staffSupportLink(requestId),
    });
  }
  return { ok: true };
}

// ── Scheduled pass ──────────────────────────────────────────────────────

export type CarePassResult = {
  considered: number;
  reminders: number;
  dueSoon: number;
  overdue: number;
  founderNudges: number;
  confirmReminders: number;
  closed: number;
};

export async function runSupportCarePass(nowDate: Date = new Date()): Promise<CarePassResult> {
  const now = nowDate.getTime();
  const nowIso = nowDate.toISOString();
  const settings = await getSupportSettings();
  const inBiz = isBusinessTime(nowDate);
  const out: CarePassResult = { considered: 0, reminders: 0, dueSoon: 0, overdue: 0, founderNudges: 0, confirmReminders: 0, closed: 0 };

  const { data: openRows } = await svc()
    .from("support_requests")
    .select("id")
    .in("status", ["open", "pending_founder"])
    .order("created_at", { ascending: true })
    .limit(300);
  const { data: resolvedRows } = await svc()
    .from("support_requests")
    .select("id")
    .eq("status", "resolved")
    .is("csat", null)
    .is("closed_at", null)
    .order("resolved_at", { ascending: true })
    .limit(300);

  for (const { id } of (openRows ?? []) as Array<{ id: string }>) {
    const c = await loadRequestCtx(id);
    if (!c) continue;
    out.considered++;
    const r = c.request;
    const fid = r.founder_id;

    // Promised reply time: heads up, then escalate and tell the founder honestly.
    if (r.status === "open" && r.due_at) {
      const due = new Date(r.due_at).getTime();
      if (due <= now) {
        const notified = await notifyStaffAbout(c, "overdue", { settings, message: c.lastStaffMessage ? null : c.firstMessage });
        const newDue = addBusinessHours(nowDate, settings.replyTargetHours).toISOString();
        // The founder hears "more time" once per request; later misses only escalate to staff.
        const tellFounder = !r.overdue_alerted_at;
        await patch(id, { due_at: newDue, overdue_alerted_at: nowIso, due_soon_alerted_at: null });
        await logSupportEvent({
          requestId: id,
          founderId: fid,
          actor: "alert",
          kind: "overdue",
          summary: "Promised reply time missed. Escalated",
          detail: notified.length ? `Alerted ${notified.join(", ")}` : null,
          meta: { missedDueAt: r.due_at, newDueAt: newDue },
        });
        if (c.founder && tellFounder) {
          await createNotification({
            recipientUserId: c.founder.id,
            type: "support_update",
            title: "Update on your request",
            message: `${c.owner?.name ?? "Our team"} needs a bit more time. New reply time set.`,
            entityType: "company",
            entityId: r.company_id,
            deepLink: founderSupportLink(id),
          });
          const sent = await deliverSupportEmail({
            to: c.founder.email,
            userId: c.founder.id,
            type: "support_update",
            deepLink: founderSupportLink(id),
            requestId: id,
            email: moreTimeEmail(founderCtx(c), newDue),
          });
          await logSupportEvent({
            requestId: id,
            founderId: fid,
            actor: "system",
            kind: "founder_notified",
            summary: `Founder told: more time needed${sent ? " (bell and email)" : " (bell)"}`,
            meta: { newDueAt: newDue },
          });
        }
        out.overdue++;
        continue;
      }
      if (due - now <= DUE_SOON_MS && !r.due_soon_alerted_at) {
        const notified = await notifyStaffAbout(c, "due_soon", { settings });
        await patch(id, { due_soon_alerted_at: nowIso });
        await logSupportEvent({
          requestId: id,
          founderId: fid,
          actor: "alert",
          kind: "due_soon",
          summary: "Reply due in 2 hours",
          detail: notified.length ? `Alerted ${notified.join(", ")}` : null,
        });
        out.dueSoon++;
      }
    }

    // Repeat reminders to staff until resolved.
    if (settings.reminders.enabled && (!settings.reminders.businessHoursOnly || inBiz)) {
      const last = new Date(r.last_reminder_at ?? r.created_at).getTime();
      if (now - last >= settings.reminders.everyHours * HOUR) {
        const n = (r.reminder_count ?? 0) + 1;
        const why = r.status === "pending_founder" ? "Waiting on the founder" : r.first_staff_reply_at ? "Founder is waiting on a reply" : "No staff reply yet";
        const notified = await notifyStaffAbout(c, "reminder", { settings, message: why });
        await patch(id, { last_reminder_at: nowIso, reminder_count: n });
        await logSupportEvent({
          requestId: id,
          founderId: fid,
          actor: "alert",
          kind: "reminder",
          summary: `Reminder ${n} to staff`,
          detail: `${why}${notified.length ? ` · sent to ${notified.join(", ")}` : ""}`,
        });
        out.reminders++;
      }
    }

    // The founder owes a reply: one nudge per staff reply, after two days.
    if (r.status === "pending_founder" && c.founder) {
      const since = new Date(r.updated_at).getTime();
      const nudged = r.founder_nudged_at ? new Date(r.founder_nudged_at).getTime() : 0;
      if (now - since >= NUDGE_AFTER_MS && nudged < since) {
        await createNotification({
          recipientUserId: c.founder.id,
          type: "support_waiting_on_you",
          title: `${c.owner?.name ?? "Our team"} is waiting on you`,
          message: `Reply to keep "${r.subject}" moving.`,
          entityType: "company",
          entityId: r.company_id,
          deepLink: founderSupportLink(id),
        });
        await deliverSupportEmail({
          to: c.founder.email,
          userId: c.founder.id,
          type: "support_waiting_on_you",
          deepLink: founderSupportLink(id),
          requestId: id,
          email: waitingOnYouEmail(founderCtx(c), c.lastStaffMessage),
        });
        await patch(id, { founder_nudged_at: nowIso });
        await logSupportEvent({ requestId: id, founderId: fid, actor: "system", kind: "founder_nudged", summary: "Founder nudged: waiting on their reply" });
        out.founderNudges++;
      }
    }
  }

  // "Did this solve it?": one reminder on day 2, close on day 7.
  for (const { id } of (resolvedRows ?? []) as Array<{ id: string }>) {
    const c = await loadRequestCtx(id);
    if (!c || !c.request.resolved_at) continue;
    out.considered++;
    const age = now - new Date(c.request.resolved_at).getTime();
    if (age >= AUTO_CLOSE_MS) {
      await patch(id, { closed_at: nowIso });
      if (c.founder) {
        await deliverSupportEmail({
          to: c.founder.email,
          userId: c.founder.id,
          type: "support_closed",
          deepLink: founderSupportLink(id),
          requestId: id,
          email: closedEmail(founderCtx(c)),
        });
      }
      await logSupportEvent({ requestId: id, founderId: c.request.founder_id, actor: "system", kind: "closed", summary: "Closed automatically after 7 days with no answer" });
      out.closed++;
    } else if (age >= CONFIRM_REMINDER_MS && !c.request.confirm_reminded_at) {
      if (c.founder) {
        await deliverSupportEmail({
          to: c.founder.email,
          userId: c.founder.id,
          type: "support_confirm_reminder",
          deepLink: founderSupportLink(id),
          requestId: id,
          email: resolvedEmail(founderCtx(c), c.request.resolution_summary, true),
        });
      }
      await patch(id, { confirm_reminded_at: nowIso });
      await logSupportEvent({ requestId: id, founderId: c.request.founder_id, actor: "system", kind: "confirm_reminder", summary: 'Reminder: "Did this solve your issue?"' });
      out.confirmReminders++;
    }
  }

  return out;
}
