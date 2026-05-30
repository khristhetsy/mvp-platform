import type { SupabaseClient } from "@supabase/supabase-js";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { appendThreadMessage } from "@/lib/messaging/threads";
import {
  notifyMeetingAccepted,
  notifyMeetingCanceled,
  notifyMeetingDeclined,
  notifyMeetingRequested,
} from "@/lib/notifications/messaging-events";
import type { MessageThreadRecord, ThreadMeetingRecord, ThreadMeetingStatus } from "@/lib/messaging/types";
import type { Database } from "@/lib/supabase/types";

export type CreateMeetingInput = {
  thread: MessageThreadRecord;
  requestedBy: string;
  proposedStartTime?: string | null;
  proposedEndTime?: string | null;
  timezone?: string | null;
  meetingTitle?: string | null;
  meetingNotes?: string | null;
};

export async function createThreadMeeting(
  supabase: SupabaseClient<Database>,
  input: CreateMeetingInput,
) {
  const now = new Date().toISOString();
  const title =
    input.meetingTitle?.trim() ||
    `Intro meeting — ${input.thread.company_id.slice(0, 8)}`;

  const { data: meeting, error } = await supabase
    .from("thread_meetings")
    .insert({
      thread_id: input.thread.id,
      company_id: input.thread.company_id,
      founder_id: input.thread.founder_id,
      investor_id: input.thread.investor_id,
      requested_by: input.requestedBy,
      status: "proposed",
      proposed_start_time: input.proposedStartTime ?? null,
      proposed_end_time: input.proposedEndTime ?? null,
      timezone: input.timezone ?? "UTC",
      meeting_title: title,
      meeting_notes: input.meetingNotes ?? null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !meeting) {
    return { error: error ?? new Error("Unable to create meeting request.") };
  }

  const timeLabel = formatMeetingTime(meeting);
  await appendThreadMessage(supabase, {
    threadId: input.thread.id,
    senderId: input.requestedBy,
    body: `Meeting requested${timeLabel ? `: ${timeLabel}` : ""}.`,
    messageType: "meeting_request",
    bumpThreadActive: true,
  });

  await recordInvestorCrmActivity(supabase, {
    investorId: input.thread.investor_id,
    companyId: input.thread.company_id,
    activityType: "meeting_requested",
    metadata: { threadId: input.thread.id, meetingId: meeting.id },
  });

  const recipientId =
    input.requestedBy === input.thread.founder_id
      ? input.thread.investor_id
      : input.thread.founder_id;

  void notifyMeetingRequested({
    threadId: input.thread.id,
    meetingId: meeting.id,
    recipientUserId: recipientId,
    actorUserId: input.requestedBy,
    companyId: input.thread.company_id,
  });

  return { data: meeting as ThreadMeetingRecord };
}

export type UpdateMeetingAction = "accept" | "decline" | "cancel" | "propose";

export async function updateThreadMeeting(
  supabase: SupabaseClient<Database>,
  input: {
    meeting: ThreadMeetingRecord;
    thread: MessageThreadRecord;
    actorUserId: string;
    action: UpdateMeetingAction;
    proposedStartTime?: string | null;
    proposedEndTime?: string | null;
    timezone?: string | null;
    meetingNotes?: string | null;
  },
) {
  const now = new Date().toISOString();
  let status: ThreadMeetingStatus = input.meeting.status;
  const patch: Database["public"]["Tables"]["thread_meetings"]["Update"] = { updated_at: now };

  if (input.action === "accept") {
    status = isGoogleCalendarConfigured() ? "scheduled" : "accepted";
    patch.status = status;
    if (status === "scheduled") {
      patch.external_calendar_provider = "google";
    }
  } else if (input.action === "decline") {
    status = "declined";
    patch.status = status;
  } else if (input.action === "cancel") {
    status = "canceled";
    patch.status = status;
  } else if (input.action === "propose") {
    status = "proposed";
    patch.status = status;
    if (input.proposedStartTime !== undefined) {
      patch.proposed_start_time = input.proposedStartTime;
    }
    if (input.proposedEndTime !== undefined) {
      patch.proposed_end_time = input.proposedEndTime;
    }
    if (input.timezone !== undefined) {
      patch.timezone = input.timezone;
    }
    if (input.meetingNotes !== undefined) {
      patch.meeting_notes = input.meetingNotes;
    }
  }

  const { data: updated, error } = await supabase
    .from("thread_meetings")
    .update(patch)
    .eq("id", input.meeting.id)
    .select("*")
    .single();

  if (error || !updated) {
    return { error: error ?? new Error("Unable to update meeting.") };
  }

  let systemBody = "";
  if (input.action === "accept") {
    systemBody =
      "Meeting accepted. Google Calendar/Meet integration coming soon — times are stored in CapitalOS until connected.";
    await appendThreadMessage(supabase, {
      threadId: input.thread.id,
      senderId: input.actorUserId,
      body: systemBody,
      messageType: "meeting_scheduled",
      bumpThreadActive: true,
    });
    await recordInvestorCrmActivity(supabase, {
      investorId: input.thread.investor_id,
      companyId: input.thread.company_id,
      activityType: "meeting_accepted",
      metadata: { meetingId: input.meeting.id },
    });
    void notifyMeetingAccepted({
      threadId: input.thread.id,
      meetingId: input.meeting.id,
      recipientUserId:
        input.actorUserId === input.thread.founder_id
          ? input.thread.investor_id
          : input.thread.founder_id,
      actorUserId: input.actorUserId,
      companyId: input.thread.company_id,
    });
  } else if (input.action === "decline") {
    systemBody = "Meeting declined.";
    await appendThreadMessage(supabase, {
      threadId: input.thread.id,
      senderId: input.actorUserId,
      body: systemBody,
      messageType: "system_note",
      bumpThreadActive: true,
    });
    await recordInvestorCrmActivity(supabase, {
      investorId: input.thread.investor_id,
      companyId: input.thread.company_id,
      activityType: "meeting_declined",
      metadata: { meetingId: input.meeting.id },
    });
    void notifyMeetingDeclined({
      threadId: input.thread.id,
      meetingId: input.meeting.id,
      recipientUserId:
        input.actorUserId === input.thread.founder_id
          ? input.thread.investor_id
          : input.thread.founder_id,
      actorUserId: input.actorUserId,
      companyId: input.thread.company_id,
    });
  } else if (input.action === "cancel") {
    systemBody = "Meeting canceled.";
    await appendThreadMessage(supabase, {
      threadId: input.thread.id,
      senderId: input.actorUserId,
      body: systemBody,
      messageType: "system_note",
      bumpThreadActive: true,
    });
    void notifyMeetingCanceled({
      threadId: input.thread.id,
      meetingId: input.meeting.id,
      recipientUserId:
        input.actorUserId === input.thread.founder_id
          ? input.thread.investor_id
          : input.thread.founder_id,
      actorUserId: input.actorUserId,
      companyId: input.thread.company_id,
    });
  } else if (input.action === "propose") {
    const timeLabel = formatMeetingTime(updated);
    systemBody = `Meeting time proposed${timeLabel ? `: ${timeLabel}` : ""}.`;
    await appendThreadMessage(supabase, {
      threadId: input.thread.id,
      senderId: input.actorUserId,
      body: systemBody,
      messageType: "meeting_request",
      bumpThreadActive: true,
    });
    void notifyMeetingRequested({
      threadId: input.thread.id,
      meetingId: input.meeting.id,
      recipientUserId:
        input.actorUserId === input.thread.founder_id
          ? input.thread.investor_id
          : input.thread.founder_id,
      actorUserId: input.actorUserId,
      companyId: input.thread.company_id,
    });
  }

  return { data: updated as ThreadMeetingRecord };
}

function formatMeetingTime(meeting: {
  proposed_start_time: string | null;
  proposed_end_time: string | null;
  timezone: string | null;
}) {
  if (!meeting.proposed_start_time) {
    return "";
  }

  const start = new Date(meeting.proposed_start_time).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: meeting.timezone ?? "UTC",
  });

  if (!meeting.proposed_end_time) {
    return start;
  }

  const end = new Date(meeting.proposed_end_time).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: meeting.timezone ?? "UTC",
  });

  return `${start} – ${end}`;
}
