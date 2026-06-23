// Read-only list of the user's upcoming Google Meet meetings, sourced from
// their primary Google Calendar (events that carry a Meet link).

import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";

const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type MeetGuest = { email: string; displayName: string | null; responseStatus: string | null };
export type MeetMeeting = {
  id: string;
  title: string;
  start: string;
  end: string;
  meetUrl: string;
  phone: string | null;
  pin: string | null;
  organizer: { email: string | null; displayName: string | null } | null;
  guests: MeetGuest[];
};

type ApiEntryPoint = { entryPointType?: string; uri?: string; label?: string; pin?: string };
type ApiEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: ApiEntryPoint[] };
  organizer?: { email?: string; displayName?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
};

/** Upcoming events (next 14 days) that have a Google Meet link. Read-only. */
export async function listUpcomingMeetings(userId: string): Promise<{ connected: boolean; meetings: MeetMeeting[] }> {
  const token = await getValidGoogleAccessToken(userId);
  if (!("accessToken" in token) || !token.accessToken) return { connected: false, meetings: [] };

  const now = new Date();
  const url = new URL(CALENDAR_EVENTS_URL);
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("timeMax", new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token.accessToken}` } });
  const payload = (await res.json().catch(() => null)) as { items?: ApiEvent[]; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(payload?.error?.message ?? "Unable to list meetings.");

  const meetings: MeetMeeting[] = [];
  for (const it of payload?.items ?? []) {
    const video = it.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
    const meetUrl = it.hangoutLink ?? video?.uri ?? null;
    if (!meetUrl) continue;
    const start = it.start?.dateTime ?? (it.start?.date ? `${it.start.date}T00:00:00.000Z` : null);
    const end = it.end?.dateTime ?? (it.end?.date ? `${it.end.date}T00:00:00.000Z` : null);
    if (!it.id || !start || !end) continue;

    const phoneEp = it.conferenceData?.entryPoints?.find((e) => e.entryPointType === "phone");
    meetings.push({
      id: it.id,
      title: it.summary ?? "(no title)",
      start,
      end,
      meetUrl,
      phone: phoneEp?.label ?? (phoneEp?.uri ? phoneEp.uri.replace(/^tel:/, "") : null),
      pin: phoneEp?.pin ?? null,
      organizer: it.organizer ? { email: it.organizer.email ?? null, displayName: it.organizer.displayName ?? null } : null,
      guests: (it.attendees ?? [])
        .map((a) => ({ email: a.email ?? "", displayName: a.displayName ?? null, responseStatus: a.responseStatus ?? null }))
        .filter((g) => g.email),
    });
  }
  return { connected: true, meetings };
}
