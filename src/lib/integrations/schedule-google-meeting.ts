import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { createCalendarEventWithMeet } from "@/lib/integrations/google-calendar";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import type { MessageThreadRecord, ThreadMeetingRecord } from "@/lib/messaging/types";

const DEFAULT_MEETING_MINUTES = 30;

export type ScheduleGoogleMeetingResult =
  | { scheduled: true; eventId: string; meetUrl: string | null }
  | {
      scheduled: false;
      reason: "not_configured" | "not_connected" | "missing_times" | "api_error";
      message?: string;
    };

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

export async function scheduleAcceptedMeetingOnGoogle(input: {
  hostUserId: string;
  meeting: ThreadMeetingRecord;
  thread: MessageThreadRecord;
}): Promise<ScheduleGoogleMeetingResult> {
  if (!isGoogleOAuthConfigured()) {
    return { scheduled: false, reason: "not_configured" };
  }

  const tokenResult = await getValidGoogleAccessToken(input.hostUserId);
  if (tokenResult.error || !tokenResult.accessToken) {
    return { scheduled: false, reason: "not_connected" };
  }

  const startTime = input.meeting.proposed_start_time;
  if (!startTime) {
    return { scheduled: false, reason: "missing_times" };
  }

  const timezone = input.meeting.timezone?.trim() || "UTC";
  const endTime = resolveEndTime(startTime, input.meeting.proposed_end_time);
  const attendees = await participantEmails(input.thread.founder_id, input.thread.investor_id);

  const supabase = createServiceRoleClient();
  const { data: company } = await supabase
    .from("companies")
    .select("company_name")
    .eq("id", input.thread.company_id)
    .maybeSingle();

  const title =
    input.meeting.meeting_title?.trim() ||
    `iCapOS intro — ${company?.company_name ?? "Meeting"}`;

  try {
    const event = await createCalendarEventWithMeet(
      {
        title,
        startTime,
        endTime,
        timezone,
        attendees,
        notes: input.meeting.meeting_notes,
        requestId: `capitalos-meeting-${input.meeting.id}`,
      },
      tokenResult.accessToken,
    );

    return {
      scheduled: true,
      eventId: event.eventId,
      meetUrl: event.meetUrl,
    };
  } catch (error) {
    return {
      scheduled: false,
      reason: "api_error",
      message: error instanceof Error ? error.message : "Google Calendar API error.",
    };
  }
}
