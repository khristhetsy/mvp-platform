// Weekly Meeting System — Step 3. One-way push of a meeting SESSION to Google Calendar
// with a Meet link, reusing the CEO Hub Google integration. Idempotent per session via
// gcal_instance_id (create → then PATCH). Never syncs Google → iCapOS.
import { randomUUID } from "crypto";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Build local ISO start/end from a date, a HH:MM(:SS) local time, and a duration. */
function window(date: string, timeLocal: string, durationMin: number): { start: string; end: string } {
  const [h = 0, m = 0] = timeLocal.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const total = h * 60 + m + durationMin;
  return {
    start: `${date}T${pad(h)}:${pad(m)}:00`,
    end: `${date}T${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}:00`,
  };
}

export interface SessionSyncResult { eventId: string; meetUrl: string | null }

/** Create (or update) a Google Calendar event for a meeting session, capturing the Meet link. */
export async function pushSessionToGoogle(sessionId: string, userId: string): Promise<SessionSyncResult> {
  const { data: session } = await db().from("ceo_meeting_sessions")
    .select("id, meeting_key, session_date, start_time, gcal_instance_id, meeting:ceo_meetings(name, time_local, timezone, duration_min, attendees)")
    .eq("id", sessionId).maybeSingle();
  if (!session) throw new Error("Meeting session not found.");
  const meeting = session.meeting as { name: string; time_local: string; timezone: string; duration_min: number; attendees: unknown } | null;
  if (!meeting) throw new Error("Meeting not found.");

  const { accessToken: token, error } = await getValidGoogleAccessToken(userId);
  if (error || !token) throw new Error(error?.message ?? "Connect your Google Calendar first (System → Integrations), then try again.");

  // Prefer the session's own start time; fall back to the meeting's registry time.
  const sessionTime = (session as { start_time?: string | null }).start_time;
  const { start, end } = window(String(session.session_date), sessionTime ?? meeting.time_local ?? "09:00", meeting.duration_min ?? 60);
  const attendees = Array.isArray(meeting.attendees)
    ? (meeting.attendees as Array<{ email?: string }>).map((a) => a.email).filter((e): e is string => Boolean(e)).map((email) => ({ email }))
    : [];
  const description = `${meeting.name} — ${session.session_date}\n\nOpen the meeting board: https://icapos.com/admin/meetings/${sessionId}`;

  const existingId = (session as { gcal_instance_id?: string | null }).gcal_instance_id ?? null;
  const body: Record<string, unknown> = {
    summary: `${meeting.name} — ${session.session_date}`,
    description,
    start: { dateTime: start, timeZone: meeting.timezone ?? "America/Los_Angeles" },
    end: { dateTime: end, timeZone: meeting.timezone ?? "America/Los_Angeles" },
    attendees: attendees.length ? attendees : undefined,
  };
  if (!existingId) body.conferenceData = { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };

  const url = new URL(existingId ? `${EVENTS_URL}/${existingId}` : EVENTS_URL);
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const res = await fetch(url, { method: existingId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "Unable to push to Google Calendar.");

  const meetUrl = (data?.conferenceData?.entryPoints ?? []).find((e: { entryPointType?: string }) => e.entryPointType === "video")?.uri
    ?? data?.hangoutLink ?? (session as { meet_link?: string | null }).meet_link ?? null;
  const eventId = String(data.id);

  await db().from("ceo_meeting_sessions").update({ gcal_instance_id: eventId, meet_link: meetUrl }).eq("id", sessionId);
  return { eventId, meetUrl };
}
