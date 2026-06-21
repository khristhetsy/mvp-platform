import { randomBytes } from "node:crypto";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";

const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type CalendarEventInput = {
  title: string;
  startTime: string;
  endTime: string;
  timezone: string;
  attendees?: string[];
  notes?: string | null;
  location?: string | null;
  requestId?: string;
};

export type GoogleEventFull = {
  id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  attendees: string[];
  meet_url: string | null;
};

export type CalendarEventResult = {
  provider: "google";
  eventId: string;
  meetUrl: string | null;
};

type GoogleCalendarEventResponse = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string }>;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  error?: { message?: string };
};

export function isGoogleCalendarConfigured() {
  return isGoogleOAuthConfigured();
}

function extractMeetUrl(event: GoogleCalendarEventResponse) {
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  const video = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri,
  );

  return video?.uri ?? null;
}

export async function createCalendarEventWithMeet(
  input: CalendarEventInput,
  accessToken: string,
): Promise<CalendarEventResult> {
  if (!isGoogleCalendarConfigured()) {
    throw new Error("Google Calendar integration is not configured.");
  }

  const requestId = input.requestId ?? `capitalos-${randomBytes(8).toString("hex")}`;
  const attendees = (input.attendees ?? [])
    .filter(Boolean)
    .map((email) => ({ email: email.toLowerCase() }));

  const body = {
    summary: input.title,
    description: input.notes ?? undefined,
    start: {
      dateTime: input.startTime,
      timeZone: input.timezone,
    },
    end: {
      dateTime: input.endTime,
      timeZone: input.timezone,
    },
    attendees: attendees.length > 0 ? attendees : undefined,
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const url = new URL(CALENDAR_EVENTS_URL);
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as GoogleCalendarEventResponse | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.error?.message ?? "Unable to create Google Calendar event.");
  }

  return {
    provider: "google",
    eventId: payload.id,
    meetUrl: extractMeetUrl(payload),
  };
}

export async function updateCalendarEvent(
  eventId: string,
  input: Partial<CalendarEventInput>,
  accessToken: string,
): Promise<CalendarEventResult> {
  const url = new URL(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`);
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const patch: Record<string, unknown> = {};
  if (input.title) {
    patch.summary = input.title;
  }
  if (input.notes !== undefined) {
    patch.description = input.notes;
  }
  if (input.location !== undefined) {
    patch.location = input.location;
  }
  if (input.startTime && input.timezone) {
    patch.start = { dateTime: input.startTime, timeZone: input.timezone };
  }
  if (input.endTime && input.timezone) {
    patch.end = { dateTime: input.endTime, timeZone: input.timezone };
  }
  if (input.attendees) {
    patch.attendees = input.attendees.filter(Boolean).map((email) => ({ email }));
  }

  const response = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  const payload = (await response.json().catch(() => null)) as GoogleCalendarEventResponse | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.error?.message ?? "Unable to update Google Calendar event.");
  }

  return {
    provider: "google",
    eventId: payload.id,
    meetUrl: extractMeetUrl(payload),
  };
}

/** Fetch a single Google event with full detail (description, location, attendees). */
export async function getGoogleEvent(eventId: string, accessToken: string): Promise<GoogleEventFull> {
  const url = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const e = (await response.json().catch(() => null)) as GoogleCalendarEventResponse | null;
  if (!response.ok || !e?.id) throw new Error(e?.error?.message ?? "Unable to load Google Calendar event.");
  return {
    id: e.id,
    title: e.summary ?? "",
    description: e.description ?? "",
    location: e.location ?? "",
    start_time: e.start?.dateTime ?? e.start?.date ?? "",
    end_time: e.end?.dateTime ?? e.end?.date ?? "",
    attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
    meet_url: extractMeetUrl(e),
  };
}

/**
 * Create an all-day calendar event (for tasks — no specific time, just a date).
 * Google Calendar uses exclusive end dates, so end = date + 1 day.
 */
export async function createAllDayCalendarEvent(
  input: { title: string; date: string; notes?: string | null },
  accessToken: string,
): Promise<{ eventId: string }> {
  if (!isGoogleCalendarConfigured()) {
    throw new Error("Google Calendar integration is not configured.");
  }

  const endDate = new Date(input.date);
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().slice(0, 10);

  const body = {
    summary: input.title,
    description: input.notes ?? undefined,
    start: { date: input.date },
    end: { date: endDateStr },
    reminders: { useDefault: true },
  };

  const response = await fetch(CALENDAR_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as GoogleCalendarEventResponse | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.error?.message ?? "Unable to create Google Calendar event.");
  }

  return { eventId: payload.id };
}

export type GoogleEventLite = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  meet_url: string | null;
};

type GoogleApiEvent = {
  id?: string;
  summary?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

/** Read the user's primary-calendar events between timeMin/timeMax (read-only). */
export async function listGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEventLite[]> {
  const url = new URL(CALENDAR_EVENTS_URL);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as
    | { items?: GoogleApiEvent[]; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to list Google events.");
  }

  const out: GoogleEventLite[] = [];
  for (const it of payload?.items ?? []) {
    const start = it.start?.dateTime ?? (it.start?.date ? `${it.start.date}T00:00:00.000Z` : null);
    const end = it.end?.dateTime ?? (it.end?.date ? `${it.end.date}T00:00:00.000Z` : null);
    if (!it.id || !start || !end) continue;
    out.push({
      id: it.id,
      title: it.summary ?? "(no title)",
      start_time: start,
      end_time: end,
      all_day: Boolean(it.start?.date && !it.start?.dateTime),
      meet_url: it.hangoutLink ?? null,
    });
  }
  return out;
}

export async function cancelCalendarEvent(eventId: string, accessToken: string): Promise<void> {
  const url = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Unable to cancel Google Calendar event.");
  }
}
