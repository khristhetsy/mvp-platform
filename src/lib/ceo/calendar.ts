// CEO Hub — create a weekly recurring Google Calendar event with a Meet link, on
// behalf of the connected admin (per-user OAuth; there is no service account).
// Reuses the repo's token accessor. The shared google-calendar helper doesn't set
// recurrence, so this calls the Calendar API directly with an RRULE.

import { randomUUID } from "crypto";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import type { CeoMeeting } from "@/lib/ceo/meetings";

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function pad(n: number): string { return n.toString().padStart(2, "0"); }

/** Next calendar date (YYYY-MM-DD) matching day_of_week (1=Mon..7=Sun), today inclusive. */
function nextWeekdayDate(dayOfWeek: number): string {
  const jsTarget = dayOfWeek % 7; // Mon(1)->1 ... Sun(7)->0
  const base = new Date();
  for (let i = 0; i < 7; i++) {
    const c = new Date(base);
    c.setDate(base.getDate() + i);
    if (c.getDay() === jsTarget) return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
  }
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

function localDateTimes(date: string, timeLocal: string, durationMin: number): { start: string; end: string } {
  const [hh, mm] = timeLocal.split(":").map((x) => parseInt(x, 10));
  const startMin = hh * 60 + mm;
  const endMin = startMin + durationMin;
  const start = `${date}T${pad(hh)}:${pad(mm)}:00`;
  const end = `${date}T${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}:00`;
  return { start, end };
}

function description(meeting: CeoMeeting): string {
  const agenda = meeting.agenda.map((a) => `• ${a.title}${a.minutes ? ` (${a.minutes}m)` : ""}`).join("\n");
  return `${meeting.name}\n\nAgenda:\n${agenda}\n\nOpen the log note in the CEO Hub: https://icapos.com/admin/ceo?tab=${meeting.dept}`;
}

export interface CalendarSyncResult { eventId: string; meetUrl: string | null }

export async function createRecurringMeeting(meeting: CeoMeeting, adminUserId: string): Promise<CalendarSyncResult> {
  const token = await getValidGoogleAccessToken(adminUserId);
  if (!token) throw new Error("Connect your Google Calendar first (System → Integrations), then try again.");

  const date = nextWeekdayDate(meeting.dayOfWeek);
  const { start, end } = localDateTimes(date, meeting.timeLocal, meeting.durationMin);
  const attendees = meeting.attendees.map((a) => a.email).filter((e): e is string => Boolean(e)).map((email) => ({ email }));

  const body = {
    summary: meeting.name,
    description: description(meeting),
    start: { dateTime: start, timeZone: meeting.timezone },
    end: { dateTime: end, timeZone: meeting.timezone },
    recurrence: ["RRULE:FREQ=WEEKLY"],
    attendees: attendees.length ? attendees : undefined,
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
  };

  const url = new URL(EVENTS_URL);
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "Unable to create the Google Calendar event.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meetUrl = data?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri ?? data?.hangoutLink ?? null;
  return { eventId: String(data.id), meetUrl };
}

/** Re-sync a schedule change to an already-created recurring event. Best-effort. */
export async function updateRecurringMeeting(meeting: CeoMeeting, adminUserId: string): Promise<void> {
  if (!meeting.gcalEventId) return;
  const token = await getValidGoogleAccessToken(adminUserId);
  if (!token) return;
  const date = nextWeekdayDate(meeting.dayOfWeek);
  const { start, end } = localDateTimes(date, meeting.timeLocal, meeting.durationMin);
  const attendees = meeting.attendees.map((a) => a.email).filter((e): e is string => Boolean(e)).map((email) => ({ email }));
  const body = {
    summary: meeting.name,
    description: description(meeting),
    start: { dateTime: start, timeZone: meeting.timezone },
    end: { dateTime: end, timeZone: meeting.timezone },
    attendees: attendees.length ? attendees : undefined,
  };
  const url = new URL(`${EVENTS_URL}/${meeting.gcalEventId}`);
  url.searchParams.set("sendUpdates", "all");
  await fetch(url, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
}
