/**
 * Introductions — reading, sending and answering.
 *
 * Keyed on registrations rather than profiles: most attendees at a large event
 * registered as guests with no account, and an introduction they cannot be
 * part of is worthless.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { makeToken, verifyToken } from "@/lib/signed-links/tokens";
import {
  introVars, renderBody, renderTemplate, shouldFollowUp, shouldRemindFounder,
  type Introduction, type IntroductionStatus,
} from "@/lib/icfo-events/introductions";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

const ACTION_RESPOND = "intro";
const ACTION_SCHEDULE = "intro-schedule";
const ACTION_RESCHEDULE = "intro-reschedule";

/** A signed link, so an investor with no account can answer from the email. */
export function introToken(id: string): string {
  return makeToken({ kind: "event_invite", id, action: ACTION_RESPOND });
}

export function introFromToken(token: string): string | null {
  return verifyToken({ token, kind: "event_invite", action: ACTION_RESPOND });
}

/** The founder's link for setting a time. A different action, so an investor's
 * accept link can never be replayed into the scheduling page. */
export function scheduleToken(id: string): string {
  return makeToken({ kind: "event_invite", id, action: ACTION_SCHEDULE });
}

export function introFromScheduleToken(token: string): string | null {
  return verifyToken({ token, kind: "event_invite", action: ACTION_SCHEDULE });
}

/** The investor's link for asking for a different time. Deliberately not the
 * founder's scheduling token — asking is not the same as choosing. */
export function rescheduleToken(id: string): string {
  return makeToken({ kind: "event_invite", id, action: ACTION_RESCHEDULE });
}

export function introFromRescheduleToken(token: string): string | null {
  return verifyToken({ token, kind: "event_invite", action: ACTION_RESCHEDULE });
}

export type TemplateKind = "invitation" | "follow_up";
export type IntroTemplate = { kind: TemplateKind; subject: string; body: string; updatedAt: string };

export async function listTemplates(): Promise<IntroTemplate[]> {
  const { data } = await raw().from("event_intro_templates").select("*").order("kind");
  return ((data ?? []) as Row[]).map((r) => ({
    kind: String(r.kind) as TemplateKind,
    subject: String(r.subject),
    body: String(r.body),
    updatedAt: String(r.updated_at),
  }));
}

export async function saveTemplate(
  kind: TemplateKind,
  input: { subject: string; body: string },
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.subject.trim()) return { ok: false, error: "The subject can't be empty." };
  if (!input.body.trim()) return { ok: false, error: "The message can't be empty." };
  const { error } = await raw()
    .from("event_intro_templates")
    .update({
      subject: input.subject.trim(),
      body: input.body,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("kind", kind);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type IntroRow = Introduction & {
  eventId: string;
  investorRegId: string;
  founderRegId: string;
  score: number;
  sharedSectors: string[];
  roomUrl: string | null;
  /** When they accepted or declined. Null while still unanswered. */
  respondedAt: string | null;
  /** Set by the founder once they pick a slot. */
  scheduledAt: string | null;
  scheduledEnd: string | null;
  /** Whatever the founder brought — Meet, Zoom, Teams. Not minted by us. */
  meetingUrl: string | null;
  founderReminders: number;
  lastFounderReminderAt: string | null;
  /** The investor asked for a different time; the founder still picks it. */
  rescheduleRequestedAt: string | null;
  rescheduleNote: string | null;
};

function mapIntro(r: Row): IntroRow {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    investorRegId: String(r.investor_reg_id),
    founderRegId: String(r.founder_reg_id),
    score: Number(r.score ?? 0),
    sharedSectors: Array.isArray(r.shared_sectors) ? (r.shared_sectors as string[]) : [],
    status: String(r.status) as IntroductionStatus,
    sentAt: String(r.sent_at),
    followUps: Number(r.follow_ups ?? 0),
    lastFollowUpAt: (r.last_follow_up_at as string | null) ?? null,
    roomUrl: (r.room_url as string | null) ?? null,
    respondedAt: (r.responded_at as string | null) ?? null,
    scheduledAt: (r.scheduled_at as string | null) ?? null,
    scheduledEnd: (r.scheduled_end as string | null) ?? null,
    meetingUrl: (r.meeting_url as string | null) ?? null,
    founderReminders: Number(r.founder_reminders ?? 0),
    lastFounderReminderAt: (r.last_founder_reminder_at as string | null) ?? null,
    rescheduleRequestedAt: (r.reschedule_requested_at as string | null) ?? null,
    rescheduleNote: (r.reschedule_note as string | null) ?? null,
  };
}

/** Every introduction for an event, keyed by pair so the board can join them. */
export async function listIntroductions(eventId: string): Promise<IntroRow[]> {
  const { data, error } = await raw().from("event_introductions").select("*").eq("event_id", eventId);
  if (error) {
    console.error("[introductions] list failed:", error.message);
    return [];
  }
  return ((data ?? []) as Row[]).map(mapIntro);
}

export type SendResult = { created: number; skipped: string[] };

/**
 * Record introductions for the given pairs.
 *
 * The score and shared sectors are frozen here so the email and the board can
 * never disagree about why two people were put together. A pair that already
 * has an introduction is skipped rather than duplicated — the unique index
 * enforces it, this reports it.
 */
export async function createIntroductions(
  eventId: string,
  pairs: { investorRegId: string; founderRegId: string; score: number; sharedSectors: string[] }[],
  createdBy: string | null,
): Promise<SendResult> {
  if (!pairs.length) return { created: 0, skipped: [] };

  const existing = await listIntroductions(eventId);
  const taken = new Set(existing.map((i) => [i.investorRegId, i.founderRegId].sort().join("|")));

  const fresh = pairs.filter((p) => !taken.has([p.investorRegId, p.founderRegId].sort().join("|")));
  const skipped = pairs.length - fresh.length;
  if (!fresh.length) return { created: 0, skipped: [`${skipped} already introduced`] };

  const { error } = await raw().from("event_introductions").insert(
    fresh.map((p) => ({
      event_id: eventId,
      investor_reg_id: p.investorRegId,
      founder_reg_id: p.founderRegId,
      score: p.score,
      shared_sectors: p.sharedSectors,
      created_by: createdBy,
    })),
  );
  if (error) return { created: 0, skipped: [error.message] };
  return { created: fresh.length, skipped: skipped ? [`${skipped} already introduced`] : [] };
}

/** Accept or decline. Idempotent: answering twice keeps the first answer. */
export async function respondToIntroduction(
  id: string,
  accept: boolean,
): Promise<{ ok: true; alreadyAnswered: boolean } | { ok: false; error: string }> {
  const { data } = await raw().from("event_introductions").select("*").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That introduction no longer exists." };

  const current = mapIntro(data as Row);
  if (current.status !== "sent") return { ok: true, alreadyAnswered: true };

  const { error } = await raw()
    .from("event_introductions")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, alreadyAnswered: false };
}

/** Store the room minted on acceptance. */
export async function attachRoom(id: string, url: string, expiresAt: string): Promise<void> {
  await raw()
    .from("event_introductions")
    .update({ room_url: url, room_expires_at: expiresAt })
    .eq("id", id);
}

export type FollowUpPass = {
  considered: number;
  sent: number;
  /** Why each one was skipped — a silent pass is indistinguishable from a broken one. */
  skipped: Record<string, number>;
};

/**
 * One day's founder follow-ups.
 *
 * Decides with the pure rules, then records the send. Returns a breakdown
 * rather than a bare count, because this runs unattended and "0 sent" needs to
 * be explainable.
 */
export async function runFollowUpPass(
  send: (intro: IntroRow) => Promise<boolean>,
  now: Date = new Date(),
): Promise<FollowUpPass> {
  const out: FollowUpPass = { considered: 0, sent: 0, skipped: {} };

  const { data: events } = await raw()
    .from("events")
    .select("id, starts_at")
    .in("status", ["published", "live"]);

  for (const e of ((events ?? []) as Row[])) {
    const eventId = String(e.id);
    const startsAt = (e.starts_at as string | null) ?? null;

    for (const intro of await listIntroductions(eventId)) {
      out.considered += 1;
      const decision = shouldFollowUp(intro, { now, eventStartsAt: startsAt });
      if (!decision.send) {
        out.skipped[decision.reason] = (out.skipped[decision.reason] ?? 0) + 1;
        continue;
      }
      if (!(await send(intro).catch(() => false))) {
        out.skipped["send failed"] = (out.skipped["send failed"] ?? 0) + 1;
        continue;
      }
      await raw()
        .from("event_introductions")
        .update({ follow_ups: intro.followUps + 1, last_follow_up_at: now.toISOString() })
        .eq("id", intro.id);
      out.sent += 1;
    }
  }
  return out;
}

/** Subject and body for one introduction, from the stored templates. */
export function renderIntro(
  template: IntroTemplate,
  input: Parameters<typeof introVars>[0],
): { subject: string; body: string } {
  const vars = introVars(input);
  return {
    subject: renderTemplate(template.subject, vars),
    // The body drops lines whose only content was an answer the founder never
    // gave; the subject is one line and keeps whatever it renders to.
    body: renderBody(template.body, vars),
  };
}

export type Contact = {
  registrationId: string;
  name: string;
  company: string | null;
  email: string | null;
  /** Founder answers the invitation quotes. Any of these may be missing. */
  pitch: string | null;
  stage: string | null;
  raising: string | null;
  roundSize: string | null;
};

/**
 * Who a registration belongs to.
 *
 * The typed answers win over the linked account: someone registering for an
 * event gives the name and address they want used for it, which is not always
 * the one on their profile.
 */
export async function contactsFor(regIds: string[]): Promise<Map<string, Contact>> {
  const out = new Map<string, Contact>();
  const ids = [...new Set(regIds.filter(Boolean))];
  if (!ids.length) return out;

  const { data, error } = await raw()
    .from("registrations")
    .select("id, answers, profiles:attendee_id(full_name, email)")
    .in("id", ids);
  if (error) {
    console.error("[introductions] contacts failed:", error.message);
    return out;
  }

  for (const r of ((data ?? []) as Row[])) {
    const answers = (r.answers as Record<string, unknown> | null) ?? {};
    const profile = r.profiles as { full_name?: string | null; email?: string | null } | null;
    const typed = (k: string) => (typeof answers[k] === "string" ? String(answers[k]).trim() : "");
    const email = typed("email") || profile?.email?.trim() || "";
    out.set(String(r.id), {
      registrationId: String(r.id),
      name: typed("name") || profile?.full_name?.trim() || "Attendee",
      company: typed("company") || null,
      email: email.includes("@") ? email : null,
      pitch: typed("pitch") || null,
      stage: typed("stage") || null,
      raising: typed("raising") || null,
      roundSize: typed("roundSize") || null,
    });
  }
  return out;
}

export type IntroEvent = {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
};

export type IntroDetail = {
  intro: IntroRow;
  event: IntroEvent | null;
  investor: Contact | null;
  founder: Contact | null;
};

/**
 * Everything the emailed pages need to name people and quote a date.
 *
 * The accept page used to know nothing but an id, so it could only say "you
 * have both been named to each other" without saying to whom.
 */
export async function introDetail(id: string): Promise<IntroDetail | null> {
  const { data, error } = await raw().from("event_introductions").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const intro = mapIntro(data as Row);

  const [eventRes, contacts] = await Promise.all([
    raw().from("events").select("id, title, starts_at, ends_at, timezone").eq("id", intro.eventId).maybeSingle(),
    contactsFor([intro.investorRegId, intro.founderRegId]),
  ]);

  const e = eventRes.data as Row | null;
  return {
    intro,
    event: e
      ? {
          id: String(e.id),
          title: String(e.title ?? "the event"),
          startsAt: (e.starts_at as string | null) ?? null,
          endsAt: (e.ends_at as string | null) ?? null,
          timezone: (e.timezone as string | null) ?? null,
        }
      : null,
    investor: contacts.get(intro.investorRegId) ?? null,
    founder: contacts.get(intro.founderRegId) ?? null,
  };
}

/**
 * The slots this founder has already given away, across every introduction.
 *
 * Not scoped to one event on purpose: a founder double-booked across two
 * events on the same afternoon is just as stuck.
 */
export async function founderTakenSlots(founderRegId: string, exceptIntroId?: string): Promise<string[]> {
  const { data, error } = await raw()
    .from("event_introductions")
    .select("id, scheduled_at")
    .eq("founder_reg_id", founderRegId)
    .not("scheduled_at", "is", null);
  if (error) return [];
  return ((data ?? []) as Row[])
    .filter((r) => String(r.id) !== exceptIntroId)
    .map((r) => String(r.scheduled_at));
}

export type ScheduleResult =
  | { ok: true; changed: boolean }
  | { ok: false; error: string };

/**
 * Record the slot and the link.
 *
 * Only an accepted introduction can be scheduled: a time for a meeting nobody
 * agreed to is a meeting that will not happen.
 */
export async function scheduleIntroduction(
  id: string,
  input: { startsAt: string; endsAt: string; meetingUrl: string; setBy?: string | null },
): Promise<ScheduleResult> {
  const detail = await introDetail(id);
  if (!detail) return { ok: false, error: "That introduction no longer exists." };
  if (detail.intro.status === "declined") return { ok: false, error: "That introduction was declined." };
  if (detail.intro.status !== "accepted") {
    return { ok: false, error: "That introduction has not been accepted yet." };
  }

  const already = detail.intro.scheduledAt === input.startsAt && detail.intro.meetingUrl === input.meetingUrl;

  const { error } = await raw()
    .from("event_introductions")
    .update({
      scheduled_at: input.startsAt,
      scheduled_end: input.endsAt,
      meeting_url: input.meetingUrl,
      scheduled_by: input.setBy ?? null,
      scheduled_set_at: new Date().toISOString(),
      // Picking a time answers the request, whether or not it moved.
      reschedule_requested_at: null,
      reschedule_note: null,
    })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, changed: !already };
}

/**
 * Accepted introductions with nobody's time on them.
 *
 * This is the stall the scheduling step introduced: the investor said yes and
 * is now waiting on the founder, and nothing else in the system would notice.
 */
export async function awaitingSchedule(eventId?: string): Promise<IntroRow[]> {
  let q = raw().from("event_introductions").select("*").eq("status", "accepted").is("scheduled_at", null);
  if (eventId) q = q.eq("event_id", eventId);
  const { data, error } = await q;
  if (error) {
    console.error("[introductions] awaiting schedule failed:", error.message);
    return [];
  }
  return ((data ?? []) as Row[]).map(mapIntro);
}

/** One more nudge sent to a founder who has not set a time. */
export async function recordFounderReminder(id: string, count: number, now: Date = new Date()): Promise<void> {
  await raw()
    .from("event_introductions")
    .update({ founder_reminders: count + 1, last_founder_reminder_at: now.toISOString() })
    .eq("id", id);
}

/**
 * One day's founder reminders.
 *
 * The mirror of `runFollowUpPass`, for the stall on the other side: an
 * introduction the investor accepted and the founder has not given a time to.
 * Same shape of report, for the same reason — this runs unattended.
 */
export async function runFounderReminderPass(
  send: (intro: IntroRow) => Promise<boolean>,
  now: Date = new Date(),
): Promise<FollowUpPass> {
  const out: FollowUpPass = { considered: 0, sent: 0, skipped: {} };

  const { data: events } = await raw()
    .from("events")
    .select("id, starts_at")
    .in("status", ["published", "live"]);

  for (const e of ((events ?? []) as Row[])) {
    const startsAt = (e.starts_at as string | null) ?? null;

    for (const intro of await awaitingSchedule(String(e.id))) {
      out.considered += 1;
      const decision = shouldRemindFounder(intro, { now, eventStartsAt: startsAt });
      if (!decision.send) {
        out.skipped[decision.reason] = (out.skipped[decision.reason] ?? 0) + 1;
        continue;
      }
      if (!(await send(intro).catch(() => false))) {
        out.skipped["send failed"] = (out.skipped["send failed"] ?? 0) + 1;
        continue;
      }
      await recordFounderReminder(intro.id, intro.founderReminders, now);
      out.sent += 1;
    }
  }
  return out;
}

/** Longest note we will carry to the founder. */
export const MAX_RESCHEDULE_NOTE = 400;

/**
 * The investor asks for a different time.
 *
 * Recorded rather than acted on: the founder owns the slot, so this puts the
 * introduction back in their queue instead of moving the meeting.
 */
export async function requestReschedule(
  id: string,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await raw().from("event_introductions").select("status, scheduled_at").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "That introduction no longer exists." };
  const row = data as Row;
  if (String(row.status) !== "accepted") {
    return { ok: false, error: "There is no meeting to move." };
  }

  const { error } = await raw()
    .from("event_introductions")
    .update({
      reschedule_requested_at: new Date().toISOString(),
      reschedule_note: note?.trim() ? note.trim().slice(0, MAX_RESCHEDULE_NOTE) : null,
    })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
