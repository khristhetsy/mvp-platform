/**
 * Meetings on a Share Project record — server only. Booking goes through the existing
 * iCapOS scheduler (host hours + Google free/busy) and the CEO Hub calendar sync, so the
 * meeting lands on Google Calendar with a Meet link and the investor gets the invite.
 *
 * Booking (spec 5.8): stage → meeting_scheduled, a meeting activity carrying the
 * calendar event id, and a "Send deck before meeting" to-do due the day before.
 * Rescheduling updates the event and the activity; cancelling clears the event id.
 * The investor's email is read from Sales Hub at booking time and never stored here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { bookSlot } from "@/lib/scheduling/book";
import { cancelBookingById } from "@/lib/scheduling/cancel";
import { createBooking, getBooking } from "@/lib/scheduling/bookings";
import { computeHostSlots, loadAvailability } from "@/lib/scheduling/store";
import { sendBookingEmails } from "@/lib/scheduling/notify";
import { cancelEvent, createEvent } from "@/lib/calendar/events";
import { createActivity, db, getMatch, getProject, listActivities, updateActivity, updateMatch } from "@/lib/ir/db";
import { IR_STAGES, type IrActivity, type IrMatch } from "@/lib/ir/types";

export const DECK_SUBJECT = "Send deck before meeting";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = () => createServiceRoleClient() as unknown as SupabaseClient<any>;

export async function hostSlots(hostId: string, fromISO: string, toISO: string, duration?: number): Promise<{ slots: Array<{ start: string; end: string }>; timezone: string; durations: number[]; hasHours: boolean }> {
  const settings = await loadAvailability(admin(), hostId);
  const hasHours = settings.weeklyRules.length > 0;
  const slots = await computeHostSlots(hostId, fromISO, toISO, duration);
  return { slots, timezone: settings.timezone, durations: settings.slotDurations, hasHours };
}

type Investor = { name: string | null; firm: string | null; email: string | null };
async function investorFor(match: IrMatch): Promise<Investor> {
  const { data } = await db().from("crm_contacts").select("name, company, email").eq("id", match.investor_contact_id).maybeSingle();
  const c = data as { name: string | null; company: string | null; email: string | null } | null;
  return { name: c?.name ?? null, firm: c?.company ?? null, email: c?.email && c.email.includes("@") ? c.email : null };
}
const label = (inv: Investor) => inv.firm ?? inv.name ?? "Investor";
const when = (iso: string, tz: string) => new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const openMeeting = (acts: IrActivity[]) => acts.find((a) => a.type === "meeting" && !a.done_at && a.calendar_event_id) ?? null;
const openDeckTask = (acts: IrActivity[]) => acts.find((a) => !a.done_at && a.subject === DECK_SUBJECT) ?? null;

export type BookInput = { matchId: string; hostId: string; startTime: string; endTime: string; timezone: string; note: string | null; notify: boolean; custom: boolean; by: string };
export type BookResult = { activityId: string; bookingId: string | null; meetUrl: string | null; startTime: string; endTime: string; warning: string | null };

/** Create the calendar event + booking. `custom` skips the host-hours check (a time agreed outside the scheduler). */
async function createMeeting(i: BookInput, title: string, inv: Investor, description: string | null): Promise<{ eventId: string; meetUrl: string | null; bookingId: string | null; hostEmail: string | null; hostName: string | null; startTime: string; endTime: string }> {
  if (!i.custom) {
    const r = await bookSlot({ hostId: i.hostId, booker: { id: null, email: inv.email, name: inv.name, company: inv.firm }, startTime: i.startTime, endTime: i.endTime, timezone: i.timezone, title, note: description });
    return { eventId: r.event.id, meetUrl: r.meetUrl, bookingId: r.bookingId, hostEmail: r.hostEmail, hostName: r.hostName, startTime: r.event.start_time, endTime: r.event.end_time };
  }
  const a = admin();
  const { data: host } = await a.from("profiles").select("email, full_name").eq("id", i.hostId).single();
  const h = host as { email: string | null; full_name: string | null } | null;
  const event = await createEvent(a, i.hostId, { title, description, startTime: i.startTime, endTime: i.endTime, timezone: i.timezone, attendees: inv.email ? [{ email: inv.email, name: inv.name ?? undefined }] : [], addMeet: true });
  const bookingId = await createBooking({ host_id: i.hostId, event_id: event.id, event_type: title, booker_name: inv.name, booker_email: inv.email, booker_phone: null, booker_company: inv.firm, contact_crm_id: null, start_time: i.startTime, end_time: i.endTime, timezone: i.timezone, meet_url: event.meet_url, note: description, answers: [] }).catch(() => null);
  return { eventId: event.id, meetUrl: event.meet_url, bookingId, hostEmail: h?.email ?? null, hostName: h?.full_name ?? null, startTime: event.start_time, endTime: event.end_time };
}

export async function bookMeeting(i: BookInput): Promise<BookResult> {
  const match = await getMatch(i.matchId);
  if (!match) throw new Error("Match not found.");
  const [project, inv, acts] = await Promise.all([getProject(match.project_id), investorFor(match), listActivities({ matchId: i.matchId })]);
  if (!project) throw new Error("Project not found.");
  if (openMeeting(acts)) throw new Error("A meeting is already booked on this record — reschedule or cancel it first.");
  const title = `${project.title} × ${label(inv)} — intro`;
  const m = await createMeeting(i, title, inv, i.note);
  let warning: string | null = inv.email ? null : "The investor has no email in Sales Hub, so no calendar invite or confirmation was sent. Add the email on the contact and reschedule to invite them.";
  if (i.notify && inv.email) {
    await sendBookingEmails({ bookingId: m.bookingId, hostEmail: m.hostEmail, hostName: m.hostName, bookerEmail: inv.email, bookerName: inv.name, title, startTime: m.startTime, endTime: m.endTime, timezone: i.timezone, meetUrl: m.meetUrl }).catch(() => { warning = "Booked, but the confirmation email could not be sent."; });
  }
  const activity = await createActivity({ projectId: project.id, matchId: match.id, taskId: match.task_id, type: "meeting", subject: `Meeting with ${label(inv)}`, description: m.meetUrl ? `Google Meet: ${m.meetUrl}` : null, dueAt: m.startTime, calendarEventId: m.eventId, founderVisible: true, assigneeId: i.hostId, createdBy: i.by });
  const deckDue = new Date(new Date(m.startTime).getTime() - 24 * 3600_000).toISOString();
  await createActivity({ projectId: project.id, matchId: match.id, taskId: match.task_id, type: "document", subject: DECK_SUBJECT, description: `Meeting ${when(m.startTime, i.timezone)}`, dueAt: deckDue, founderVisible: false, assigneeId: i.hostId, createdBy: i.by });
  const patch: Parameters<typeof updateMatch>[1] = { meeting_booking_id: m.bookingId };
  if (IR_STAGES.indexOf(match.stage) < IR_STAGES.indexOf("meeting_scheduled")) patch.stage = "meeting_scheduled";
  await updateMatch(match.id, patch, i.by);
  return { activityId: activity.id, bookingId: m.bookingId, meetUrl: m.meetUrl, startTime: m.startTime, endTime: m.endTime, warning };
}

export async function rescheduleMeeting(i: BookInput): Promise<BookResult> {
  const match = await getMatch(i.matchId);
  if (!match) throw new Error("Match not found.");
  const [project, inv, acts] = await Promise.all([getProject(match.project_id), investorFor(match), listActivities({ matchId: i.matchId })]);
  if (!project) throw new Error("Project not found.");
  const current = openMeeting(acts);
  if (!current) throw new Error("There is no booked meeting to reschedule.");
  const title = `${project.title} × ${label(inv)} — intro`;
  const m = await createMeeting(i, title, inv, i.note ?? null);
  if (match.meeting_booking_id) await cancelBookingById(match.meeting_booking_id, { notify: false }).catch(() => {});
  else if (current.calendar_event_id) await cancelEvent(admin(), current.assignee_id ?? i.hostId, current.calendar_event_id).catch(() => {});
  let warning: string | null = inv.email ? null : "Rescheduled, but the investor has no email in Sales Hub, so no invite was sent.";
  if (i.notify && inv.email) await sendBookingEmails({ bookingId: m.bookingId, hostEmail: m.hostEmail, hostName: m.hostName, bookerEmail: inv.email, bookerName: inv.name, title, startTime: m.startTime, endTime: m.endTime, timezone: i.timezone, meetUrl: m.meetUrl }).catch(() => { warning = "Rescheduled, but the confirmation email could not be sent."; });
  await updateActivity(current.id, { due_at: m.startTime, description: m.meetUrl ? `Google Meet: ${m.meetUrl}` : null, assignee_id: i.hostId });
  await db().from("ir_activities").update({ calendar_event_id: m.eventId }).eq("id", current.id);
  const deck = openDeckTask(acts);
  const deckDue = new Date(new Date(m.startTime).getTime() - 24 * 3600_000).toISOString();
  if (deck) await updateActivity(deck.id, { due_at: deckDue, description: `Meeting ${when(m.startTime, i.timezone)}`, assignee_id: i.hostId });
  else await createActivity({ projectId: project.id, matchId: match.id, taskId: match.task_id, type: "document", subject: DECK_SUBJECT, description: `Meeting ${when(m.startTime, i.timezone)}`, dueAt: deckDue, founderVisible: false, assigneeId: i.hostId, createdBy: i.by });
  await updateMatch(match.id, { meeting_booking_id: m.bookingId }, i.by);
  return { activityId: current.id, bookingId: m.bookingId, meetUrl: m.meetUrl, startTime: m.startTime, endTime: m.endTime, warning };
}

/** Cancel: booking + calendar event go, the activity becomes a dated "Meeting cancelled" note with no event id, the deck to-do is removed. */
export async function cancelMeeting(i: { matchId: string; notify: boolean; by: string }): Promise<void> {
  const match = await getMatch(i.matchId);
  if (!match) throw new Error("Match not found.");
  const acts = await listActivities({ matchId: i.matchId });
  const current = openMeeting(acts);
  if (!current) throw new Error("There is no booked meeting to cancel.");
  if (match.meeting_booking_id) await cancelBookingById(match.meeting_booking_id, { notify: i.notify }).catch(() => {});
  else if (current.calendar_event_id) await cancelEvent(admin(), current.assignee_id ?? i.by, current.calendar_event_id).catch(() => {});
  await db().from("ir_activities").update({ type: "note", subject: "Meeting cancelled", outcome: `Was booked for ${current.due_at ? new Date(current.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}`, due_at: null, done_at: new Date().toISOString(), calendar_event_id: null, founder_visible: false, updated_at: new Date().toISOString() }).eq("id", current.id);
  const deck = openDeckTask(acts);
  if (deck) await db().from("ir_activities").delete().eq("id", deck.id);
  await updateMatch(match.id, { meeting_booking_id: null }, i.by);
}

/** Current booking summary for the panel (Meet link, host, times). */
export async function meetingSummary(match: IrMatch, acts: IrActivity[]): Promise<{ activity: IrActivity; meetUrl: string | null; hostName: string | null; timezone: string | null } | null> {
  const current = openMeeting(acts);
  if (!current) return null;
  const b = match.meeting_booking_id ? await getBooking(match.meeting_booking_id) : null;
  return { activity: current, meetUrl: b?.meet_url ?? current.description?.replace(/^Google Meet: /, "") ?? null, hostName: b?.host_name ?? null, timezone: b?.timezone ?? null };
}
