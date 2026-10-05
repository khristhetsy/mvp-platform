/**
 * The invitation runner, called by /api/cron/event-invitations every 15 minutes.
 *
 * Invitation track, per person, until they register for every chosen event:
 *   invite    when the campaign's send time arrives
 *   day3      3 days later, only if they opened and have not registered
 *   day7      7 days later, only if they never opened (new subject)
 *   lastcall  5 days before the next event they have not registered for
 * Stops on: registered for all events, unsubscribed, or no upcoming event left.
 *
 * Attendee track, per registration that came from an invitation:
 *   confirm (instantly), reminder_1d, reminder_1h, followup (the day after).
 *
 * Every send is recorded in event_invitation_sends; unique indexes there make a
 * second send of the same step impossible even if two passes overlap.
 */
import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMarketingEmail, makeUnsubscribeToken } from "@/lib/marketing/send";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import { getLiveCounts } from "@/lib/icfo-events/invitations/live-stats";
import { registeredEventIds } from "@/lib/icfo-events/invitations/person";
import { getCampaign, type Campaign } from "@/lib/icfo-events/invitations/store";
import { inviteToken } from "@/lib/icfo-events/invitations/token";
import { renderAttendeeEmail, renderInviteEmail, type EmailEvent, type InviteStep } from "@/lib/icfo-events/invitations/emails";
import { STAT_ORDER, statTiles, OFFERS, OFFER_ANSWER_KEY, type InviteRole } from "@/lib/icfo-events/invitations/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MAX_SENDS_PER_PASS = 150;
export const SIGN_UP_URL = "https://icapos.com/start";

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

export type EventInfo = { id: string; slug: string; title: string; startsAt: string; endsAt: string | null; timezone: string | null; status: string };

export async function loadEvents(ids: string[]): Promise<EventInfo[]> {
  if (!ids.length) return [];
  const { data } = await db().from("events").select("id, slug, title, starts_at, ends_at, timezone, status").in("id", ids);
  return ((data ?? []) as Array<Record<string, string | null>>)
    .map((e) => ({ id: String(e.id), slug: String(e.slug), title: String(e.title), startsAt: String(e.starts_at), endsAt: e.ends_at, timezone: e.timezone, status: String(e.status) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Events whose numbers are shown: the next one, or all of them combined. Pure. */
export function statEventIds(c: Pick<Campaign, "stats">, upcoming: Array<{ id: string }>): string[] {
  if (!upcoming.length) return [];
  return c.stats.per === "event" ? [upcoming[0].id] : upcoming.map((e) => e.id);
}

/** Events still ahead and open to the public. */
export function upcomingEvents(events: EventInfo[]): EventInfo[] {
  const now = Date.now();
  return events.filter((e) => Date.parse(e.startsAt) > now && e.status !== "draft" && e.status !== "archived");
}

export function emailEvent(e: EventInfo): EmailEvent {
  return { title: e.title, dateLabel: formatSlot(e.startsAt, e.timezone), url: `${appUrl()}/events/${e.slug}`, joinUrl: `${appUrl()}/events/${e.slug}/lobby` };
}

/**
 * Which invitation step is due now, or null. `skip` steps are recorded so they
 * are not reconsidered. Pure.
 */
export function nextInviteStep(input: {
  now: number;
  stepsSent: string[];
  firstSentAt: string | null;
  openedAt: string | null;
  nextEventStart: string | null;
}): { step: InviteStep; send: boolean } | null {
  const { now, stepsSent, firstSentAt, openedAt, nextEventStart } = input;
  const done = (s: string) => stepsSent.includes(s) || stepsSent.includes(`${s}:skip`);
  if (!done("invite")) return { step: "invite", send: true };
  const first = firstSentAt ? Date.parse(firstSentAt) : now;
  const lastCallAt = nextEventStart ? Date.parse(nextEventStart) - 5 * DAY : null;
  const inLastCall = lastCallAt !== null && now >= lastCallAt && now < Date.parse(nextEventStart!);
  if (!done("day3") && now >= first + 3 * DAY) {
    // Close to the event the last call says it better; skip the day 3 note.
    if (inLastCall) return { step: "day3", send: false };
    return { step: "day3", send: Boolean(openedAt) };
  }
  if (!done("day7") && now >= first + 7 * DAY) {
    if (inLastCall) return { step: "day7", send: false };
    return { step: "day7", send: !openedAt };
  }
  if (!done("lastcall") && inLastCall && now >= first + DAY) return { step: "lastcall", send: true };
  return null;
}

async function profileIdForEmail(email: string): Promise<string | null> {
  const { data } = await db().from("profiles").select("id").ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function isUnsubscribed(email: string): Promise<boolean> {
  const { data } = await db().from("marketing_unsubscribes").select("email").ilike("email", email.trim()).limit(1).maybeSingle();
  return Boolean(data);
}

type InvRow = {
  id: string; role: InviteRole; email: string; first_name: string | null; company: string | null;
  steps_sent: string[] | null; first_sent_at: string | null; opened_at: string | null;
  registered_event_ids: string[] | null;
};

async function runCampaign(c: Campaign, budget: { left: number }): Promise<{ sent: number; failed: number; finished: number }> {
  const stats = { sent: 0, failed: 0, finished: 0 };
  const now = Date.now();
  const events = await loadEvents(c.eventIds);
  const upcoming = events.filter((e) => Date.parse(e.startsAt) > now && e.status !== "archived" && e.status !== "draft");
  const counts = await getLiveCounts(statEventIds(c, upcoming));

  const { data } = await db().from("event_invitations")
    .select("id, role, email, first_name, company, steps_sent, first_sent_at, opened_at, registered_event_ids")
    .eq("campaign_id", c.id).eq("status", "active")
    .order("last_sent_at", { ascending: true, nullsFirst: true })
    .limit(400);
  const rows = (data ?? []) as InvRow[];

  for (const inv of rows) {
    if (budget.left <= 0) break;
    if (!upcoming.length) {
      await db().from("event_invitations").update({ status: "done", stopped_reason: "no upcoming event" }).eq("id", inv.id);
      stats.finished += 1;
      continue;
    }
    if (await isUnsubscribed(inv.email)) {
      await db().from("event_invitations").update({ status: "stopped", stopped_reason: "unsubscribed" }).eq("id", inv.id);
      stats.finished += 1;
      continue;
    }
    // Registrations found by email or account, plus any recorded when they
    // registered through their link (they may have typed a different email).
    const found = await registeredEventIds(upcoming.map((e) => e.id), { email: inv.email, profileId: await profileIdForEmail(inv.email) });
    const registered = [...new Set([...found, ...(inv.registered_event_ids ?? [])])].filter((id) => upcoming.some((e) => e.id === id));
    const open = upcoming.filter((e) => !registered.includes(e.id));
    if (!open.length) {
      await db().from("event_invitations").update({ status: "done", stopped_reason: "registered", registered_event_ids: registered }).eq("id", inv.id);
      stats.finished += 1;
      continue;
    }
    if (registered.length) await db().from("event_invitations").update({ registered_event_ids: registered }).eq("id", inv.id);

    const steps = inv.steps_sent ?? [];
    const due = nextInviteStep({ now, stepsSent: steps, firstSentAt: inv.first_sent_at, openedAt: inv.opened_at, nextEventStart: open[0].startsAt });
    if (!due) continue;
    if (!due.send) {
      await db().from("event_invitations").update({ steps_sent: [...steps, `${due.step}:skip`] }).eq("id", inv.id);
      continue;
    }

    const audience = c.audiences.find((a) => a.role === inv.role);
    const token = inviteToken(inv.id);
    const tiles = statTiles(counts, c.stats, STAT_ORDER[inv.role]);
    const { subject, html } = renderInviteEmail({
      role: inv.role,
      step: due.step,
      firstName: inv.first_name,
      events: open.map(emailEvent),
      offers: audience?.offers ?? OFFERS[inv.role].map((o) => o.key),
      tiles,
      statsImageUrl: tiles.length ? `${appUrl()}/api/events/invite-stats/${encodeURIComponent(token)}` : null,
      ctaUrl: `${appUrl()}/events/invite/${encodeURIComponent(token)}`,
      subjectOverride: audience?.subject,
      introOverride: audience?.intro,
    });

    // Claim the step first; the unique index stops a parallel pass sending it too.
    const { error: claimErr } = await db().from("event_invitation_sends").insert({ invitation_id: inv.id, kind: due.step, ok: true });
    if (claimErr) continue;
    const res = await sendMarketingEmail({
      to: inv.email, first_name: inv.first_name, company: inv.company,
      from_name: c.fromName, from_email: c.fromEmail,
      subject, html_body: html,
      unsubscribe_token: makeUnsubscribeToken(inv.email),
    });
    budget.left -= 1;
    if (!res.ok) {
      await db().from("event_invitation_sends").update({ ok: false, error: res.error ?? "send failed" }).eq("invitation_id", inv.id).eq("kind", due.step).is("registration_id", null);
      stats.failed += 1;
      continue;
    }
    await db().from("event_invitation_sends").update({ resend_id: res.resend_id }).eq("invitation_id", inv.id).eq("kind", due.step).is("registration_id", null).eq("ok", true);
    const at = new Date().toISOString();
    await db().from("event_invitations").update({
      steps_sent: [...steps, due.step],
      last_sent_at: at,
      ...(inv.first_sent_at ? {} : { first_sent_at: at }),
    }).eq("id", inv.id);
    stats.sent += 1;
    await new Promise((r) => setTimeout(r, 120));
  }

  const { count } = await db().from("event_invitations").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "active");
  if ((count ?? 0) === 0) await db().from("event_invitation_campaigns").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", c.id);
  return stats;
}

/** Labels of the activities a registrant ticked. Pure. */
export function chosenActivities(role: InviteRole | null, answers: Record<string, unknown>): string[] {
  const out: string[] = [];
  const offers = role ? OFFERS[role] : [];
  for (const o of offers) {
    const key = OFFER_ANSWER_KEY[o.key];
    if (key ? answers[key] === true : o.key === "networking" || o.key === "talk_show" || o.key === "prescreened") out.push(o.label);
  }
  return out;
}

const ROLE_FOR_TYPE: Record<string, InviteRole> = { founder: "founder", investor: "investor", service: "advisor" };

/** Which attendee email is due for a registration, or null. Pure. */
export function nextAttendeeStep(now: number, startsAt: string, endsAt: string | null, sent: string[]): "confirm" | "reminder_1d" | "reminder_1h" | "followup" | null {
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : start + 2 * HOUR;
  if (!sent.includes("confirm") && now < end) return "confirm";
  if (!sent.includes("reminder_1d") && now >= start - DAY && now < start - HOUR) return "reminder_1d";
  if (!sent.includes("reminder_1h") && now >= start - HOUR && now < start) return "reminder_1h";
  if (!sent.includes("followup") && now >= end + 12 * HOUR && now < end + 3 * DAY) return "followup";
  return null;
}

/** Send one attendee email now, if not sent before. Used by the runner and right after registering. */
export async function sendAttendeeEmail(registrationId: string, step: "confirm" | "reminder_1d" | "reminder_1h" | "followup"): Promise<boolean> {
  const { data: reg } = await db().from("registrations")
    .select("id, event_id, attendee_id, attendee_type, answers, invitation_id")
    .eq("id", registrationId).maybeSingle();
  if (!reg) return false;
  const [event] = await loadEvents([reg.event_id]);
  if (!event) return false;
  const answers = (reg.answers ?? {}) as Record<string, unknown>;
  let email = typeof answers.email === "string" ? answers.email : null;
  if (!email && reg.attendee_id) {
    const { data: p } = await db().from("profiles").select("email").eq("id", reg.attendee_id).maybeSingle();
    email = p?.email ?? null;
  }
  if (!email || (await isUnsubscribed(email))) return false;

  let campaign: Campaign | null = null;
  if (reg.invitation_id) {
    const { data: inv } = await db().from("event_invitations").select("campaign_id").eq("id", reg.invitation_id).maybeSingle();
    if (inv) campaign = await getCampaign(String(inv.campaign_id));
  }
  const role = ROLE_FOR_TYPE[String(reg.attendee_type ?? "")] ?? null;
  const name = typeof answers.name === "string" ? answers.name.split(" ")[0] : null;
  const { subject, html } = renderAttendeeEmail({
    step,
    attendeeType: String(reg.attendee_type ?? ""),
    firstName: name,
    event: emailEvent(event),
    activities: chosenActivities(role, answers),
    applyUrl: role === "founder" && answers.applyToPresent === true ? `${appUrl()}/events/${event.slug}/apply` : null,
    signUpUrl: SIGN_UP_URL,
  });

  const { error: claimErr } = await db().from("event_invitation_sends").insert({ invitation_id: reg.invitation_id ?? null, registration_id: reg.id, kind: step, ok: true });
  if (claimErr) return false;
  const res = await sendMarketingEmail({
    to: email, first_name: name,
    from_name: campaign?.fromName ?? "iCFO Capital", from_email: campaign?.fromEmail ?? "outreach@icapos.com",
    subject, html_body: html, unsubscribe_token: makeUnsubscribeToken(email),
  });
  await db().from("event_invitation_sends")
    .update(res.ok ? { resend_id: res.resend_id } : { ok: false, error: res.error ?? "send failed" })
    .eq("registration_id", reg.id).eq("kind", step).eq("ok", true);
  return res.ok;
}

async function runAttendeeTrack(budget: { left: number }): Promise<{ sent: number }> {
  let sent = 0;
  const now = Date.now();
  const { data } = await db().from("registrations")
    .select("id, event_id, events:event_id(starts_at, ends_at)")
    .not("invitation_id", "is", null)
    .limit(2000);
  const regs = ((data ?? []) as Array<{ id: string; events: { starts_at: string; ends_at: string | null } | null }>)
    .filter((r) => r.events && Date.parse(r.events.starts_at) > now - 4 * DAY);
  if (!regs.length) return { sent };
  const { data: done } = await db().from("event_invitation_sends").select("registration_id, kind").in("registration_id", regs.map((r) => r.id)).eq("ok", true);
  const sentBy = new Map<string, string[]>();
  for (const s of (done ?? []) as Array<{ registration_id: string; kind: string }>) (sentBy.get(s.registration_id) ?? sentBy.set(s.registration_id, []).get(s.registration_id)!).push(s.kind);
  for (const r of regs) {
    if (budget.left <= 0) break;
    const step = nextAttendeeStep(now, r.events!.starts_at, r.events!.ends_at, sentBy.get(r.id) ?? []);
    if (!step) continue;
    if (await sendAttendeeEmail(r.id, step)) { sent += 1; budget.left -= 1; }
  }
  return { sent };
}

export async function runEventInvitationPass(): Promise<{ campaigns: number; sent: number; failed: number; finished: number; attendee: number }> {
  const out = { campaigns: 0, sent: 0, failed: 0, finished: 0, attendee: 0 };
  const budget = { left: MAX_SENDS_PER_PASS };
  const nowIso = new Date().toISOString();
  const { data } = await db().from("event_invitation_campaigns").select("id, status")
    .in("status", ["scheduled", "sending"]).lte("schedule_at", nowIso);
  for (const row of (data ?? []) as Array<{ id: string; status: string }>) {
    if (row.status === "scheduled") await db().from("event_invitation_campaigns").update({ status: "sending" }).eq("id", row.id);
    const c = await getCampaign(row.id);
    if (!c) continue;
    const s = await runCampaign(c, budget);
    out.campaigns += 1; out.sent += s.sent; out.failed += s.failed; out.finished += s.finished;
  }
  out.attendee = (await runAttendeeTrack(budget)).sent;
  return out;
}
