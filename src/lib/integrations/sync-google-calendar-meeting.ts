import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import {
  cancelCalendarEvent,
  updateCalendarEvent,
} from "@/lib/integrations/google-calendar";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import { recordOperationalError } from "@/lib/monitoring/operational-events";
import type { MessageThreadRecord, ThreadMeetingRecord } from "@/lib/messaging/types";

const DEFAULT_MEETING_MINUTES = 30;

export type GoogleCalendarSyncResult =
  | { synced: true; kind: "updated" | "canceled" }
  | { synced: false; skipped: true; message: string }
  | { synced: false; skipped: false; message: string };

export function meetingHasGoogleCalendarEvent(meeting: ThreadMeetingRecord) {
  return (
    meeting.external_calendar_provider === "google" &&
    Boolean(meeting.external_calendar_event_id?.trim())
  );
}

function resolveEndTime(startIso: string, endIso: string | null) {
  if (endIso) {
    return endIso;
  }

  const end = new Date(startIso);
  end.setMinutes(end.getMinutes() + DEFAULT_MEETING_MINUTES);
  return end.toISOString();
}

async function participantEmails(founderId: string, investorId: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", [founderId, investorId]);

  const emails: string[] = [];
  for (const row of data ?? []) {
    if (row.email?.trim()) {
      emails.push(row.email.trim());
    }
  }

  return [...new Set(emails)];
}

export async function syncGoogleCalendarMeeting(input: {
  meeting: ThreadMeetingRecord;
  thread: MessageThreadRecord;
  action: "update" | "cancel";
  hostUserId: string | null;
}): Promise<GoogleCalendarSyncResult> {
  if (!meetingHasGoogleCalendarEvent(input.meeting)) {
    return { synced: false, skipped: true, message: "No linked Google Calendar event." };
  }

  if (!isGoogleOAuthConfigured()) {
    return { synced: false, skipped: true, message: "Google Calendar is not configured." };
  }

  const hostUserId = input.hostUserId;
  if (!hostUserId) {
    return {
      synced: false,
      skipped: false,
      message: "Original Google Calendar host is unknown. Reconnect and reschedule if needed.",
    };
  }

  const eventId = input.meeting.external_calendar_event_id!;
  const tokenResult = await getValidGoogleAccessToken(hostUserId);

  if (tokenResult.error || !tokenResult.accessToken) {
    return {
      synced: false,
      skipped: false,
      message: "Google Calendar host is disconnected. Calendar was not updated.",
    };
  }

  try {
    if (input.action === "cancel") {
      await cancelCalendarEvent(eventId, tokenResult.accessToken);
      return { synced: true, kind: "canceled" };
    }

    const startTime = input.meeting.proposed_start_time;
    if (!startTime) {
      return {
        synced: false,
        skipped: false,
        message: "Missing start time — Google Calendar was not updated.",
      };
    }

    const timezone = input.meeting.timezone?.trim() || "UTC";
    const endTime = resolveEndTime(startTime, input.meeting.proposed_end_time);
    const attendees = await participantEmails(input.thread.founder_id, input.thread.investor_id);

    const title = input.meeting.meeting_title?.trim();
    await updateCalendarEvent(
      eventId,
      {
        title: title || undefined,
        startTime,
        endTime,
        timezone,
        attendees,
        notes: input.meeting.meeting_notes,
      },
      tokenResult.accessToken,
    );

    return { synced: true, kind: "updated" };
  } catch (error) {
    recordOperationalError("google.calendar_sync_failed", error, {
      meetingId: input.meeting.id,
      action: input.action,
    });
    return {
      synced: false,
      skipped: false,
      message: error instanceof Error ? error.message : "Google Calendar sync failed.",
    };
  }
}
