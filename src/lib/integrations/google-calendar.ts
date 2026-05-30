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
  requestId?: string;
};

export type CalendarEventResult = {
  provider: "google";
  eventId: string;
  meetUrl: string | null;
};

type GoogleCalendarEventResponse = {
  id?: string;
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
