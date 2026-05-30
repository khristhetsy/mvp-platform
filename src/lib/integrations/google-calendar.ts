/**
 * Google Calendar / Google Meet integration placeholder.
 * Phase 1 stores meetings internally only — no OAuth or live API calls.
 *
 * TODO: OAuth consent flow and secure token storage per user/workspace.
 * TODO: Persist connected Google account on profiles or integration_accounts table.
 * TODO: createCalendarEventWithMeet — create event + conferenceData for Meet link.
 * TODO: updateCalendarEvent — sync time/title changes from thread_meetings.
 * TODO: cancelCalendarEvent — remove event when meeting canceled.
 */

const NOT_CONFIGURED = "Google Calendar integration not configured";

export type CalendarEventInput = {
  title: string;
  startTime: string;
  endTime: string;
  timezone: string;
  attendees?: string[];
  notes?: string | null;
};

export type CalendarEventResult = {
  provider: "google";
  eventId: string;
  meetUrl: string | null;
};

export async function createCalendarEventWithMeet(
  _input: CalendarEventInput,
): Promise<CalendarEventResult> {
  throw new Error(NOT_CONFIGURED);
}

export async function updateCalendarEvent(
  _eventId: string,
  _input: Partial<CalendarEventInput>,
): Promise<CalendarEventResult> {
  throw new Error(NOT_CONFIGURED);
}

export async function cancelCalendarEvent(_eventId: string): Promise<void> {
  throw new Error(NOT_CONFIGURED);
}

export function isGoogleCalendarConfigured() {
  return false;
}
