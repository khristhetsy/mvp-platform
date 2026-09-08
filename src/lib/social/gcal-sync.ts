/**
 * Best-effort mirror of a scheduled social post onto the staff member's primary
 * Google Calendar. Every function degrades silently: if Google isn't configured or
 * the account isn't connected, scheduling still works — the post just isn't mirrored.
 * Returns the calendar event id so callers can persist it for later update/removal.
 */

import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import {
  isGoogleCalendarConfigured,
  createTimedCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
} from "@/lib/integrations/google-calendar";

const EVENT_MINUTES = 15;

export type PostEventInput = {
  userId: string;
  existingEventId: string | null;
  title: string;
  startISO: string;
  notes?: string | null;
};

/** Create or update the calendar event for a scheduled post. Never throws. */
export async function syncPostEvent(input: PostEventInput): Promise<string | null> {
  if (!isGoogleCalendarConfigured()) return input.existingEventId;
  const tok = await getValidGoogleAccessToken(input.userId).catch(() => null);
  if (!tok || !("accessToken" in tok) || !tok.accessToken) return input.existingEventId;

  const start = new Date(input.startISO);
  if (Number.isNaN(start.getTime())) return input.existingEventId;
  const endISO = new Date(start.getTime() + EVENT_MINUTES * 60_000).toISOString();
  const title = input.title.startsWith("Post:") ? input.title : `Post: ${input.title}`;

  try {
    if (input.existingEventId) {
      await updateCalendarEvent(
        input.existingEventId,
        { title, startTime: input.startISO, endTime: endISO, timezone: "UTC", notes: input.notes ?? undefined },
        tok.accessToken,
      );
      return input.existingEventId;
    }
    const { eventId } = await createTimedCalendarEvent(
      { title, startTime: input.startISO, endTime: endISO, timezone: "UTC", notes: input.notes ?? null },
      tok.accessToken,
    );
    return eventId;
  } catch {
    return input.existingEventId;
  }
}

/** Remove the calendar event for a post (on unschedule / archive / delete). Never throws. */
export async function removePostEvent(userId: string, eventId: string | null): Promise<void> {
  if (!eventId || !isGoogleCalendarConfigured()) return;
  const tok = await getValidGoogleAccessToken(userId).catch(() => null);
  if (!tok || !("accessToken" in tok) || !tok.accessToken) return;
  try {
    await cancelCalendarEvent(eventId, tok.accessToken);
  } catch {
    /* best-effort */
  }
}
