import { createNotification, notifyCompanyFounder } from "@/lib/notifications/notifications";
import { createServiceRoleClient } from "@/lib/supabase/admin";

async function companyName(companyId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("companies").select("company_name").eq("id", companyId).maybeSingle();
  return data?.company_name ?? "a company";
}

export async function notifyThreadCreated(input: {
  threadId: string;
  companyId: string;
  founderId: string;
  investorId: string;
  createdBy: string;
}) {
  const name = await companyName(input.companyId);
  const recipientId = input.createdBy === input.founderId ? input.investorId : input.founderId;

  if (recipientId === input.founderId) {
    return notifyCompanyFounder(input.companyId, {
      actorUserId: input.createdBy,
      type: "message_thread_created",
      title: "New message thread",
      message: `A conversation thread was opened for ${name}.`,
      entityType: "message_thread",
      entityId: input.threadId,
    });
  }

  return createNotification({
    recipientUserId: recipientId,
    actorUserId: input.createdBy,
    type: "message_thread_created",
    title: "New message thread",
    message: `A conversation thread was opened for ${name}.`,
    entityType: "message_thread",
    entityId: input.threadId,
  });
}

export async function notifyMessageReceived(input: {
  threadId: string;
  recipientUserId: string;
  senderId: string;
  companyId: string;
  messageId: string;
}) {
  const name = await companyName(input.companyId);

  return createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.senderId,
    type: "message_received",
    title: "New message",
    message: `You have a new message regarding ${name}.`,
    entityType: "message_thread",
    entityId: input.threadId,
  });
}

export async function notifyMeetingRequested(input: {
  threadId: string;
  meetingId: string;
  recipientUserId: string;
  actorUserId: string;
  companyId: string;
}) {
  const name = await companyName(input.companyId);

  return createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    type: "meeting_requested",
    title: "Meeting requested",
    message: `A meeting was requested for ${name}.`,
    entityType: "thread_meeting",
    entityId: input.meetingId,
  });
}

export async function notifyMeetingAccepted(input: {
  threadId: string;
  meetingId: string;
  recipientUserId: string;
  actorUserId: string;
  companyId: string;
}) {
  const name = await companyName(input.companyId);

  return createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    type: "meeting_accepted",
    title: "Meeting accepted",
    message: `Your meeting request for ${name} was accepted.`,
    entityType: "thread_meeting",
    entityId: input.meetingId,
  });
}

async function notifyMeetingParties(input: {
  founderId: string;
  investorId: string;
  actorUserId: string;
  meetingId: string;
  type: string;
  title: string;
  message: string;
}) {
  await Promise.all([
    createNotification({
      recipientUserId: input.founderId,
      actorUserId: input.actorUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: "thread_meeting",
      entityId: input.meetingId,
    }),
    createNotification({
      recipientUserId: input.investorId,
      actorUserId: input.actorUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: "thread_meeting",
      entityId: input.meetingId,
    }),
  ]);
}

export async function notifyMeetingRescheduledOnGoogle(input: {
  meetingId: string;
  founderId: string;
  investorId: string;
  actorUserId: string;
  companyId: string;
}) {
  const name = await companyName(input.companyId);
  return notifyMeetingParties({
    founderId: input.founderId,
    investorId: input.investorId,
    actorUserId: input.actorUserId,
    meetingId: input.meetingId,
    type: "meeting_rescheduled_google",
    title: "Meeting rescheduled",
    message: `Meeting times were updated for ${name}.`,
  });
}

export async function notifyMeetingCanceledOnGoogle(input: {
  meetingId: string;
  founderId: string;
  investorId: string;
  actorUserId: string;
  companyId: string;
  declined?: boolean;
}) {
  const name = await companyName(input.companyId);
  const verb = input.declined ? "declined" : "canceled";
  return notifyMeetingParties({
    founderId: input.founderId,
    investorId: input.investorId,
    actorUserId: input.actorUserId,
    meetingId: input.meetingId,
    type: "meeting_canceled_google",
    title: input.declined ? "Meeting declined" : "Meeting canceled",
    message: `The meeting for ${name} was ${verb}.`,
  });
}

export async function notifyMeetingGoogleSyncFailed(input: {
  meetingId: string;
  founderId: string;
  investorId: string;
  actorUserId: string;
  companyId: string;
  detail: string;
}) {
  const name = await companyName(input.companyId);
  return notifyMeetingParties({
    founderId: input.founderId,
    investorId: input.investorId,
    actorUserId: input.actorUserId,
    meetingId: input.meetingId,
    type: "meeting_google_sync_failed",
    title: "Google Calendar sync issue",
    message: `${name}: ${input.detail}`,
  });
}

export async function notifyMeetingScheduledOnGoogle(input: {
  threadId: string;
  meetingId: string;
  founderId: string;
  investorId: string;
  actorUserId: string;
  companyId: string;
  meetUrl: string | null;
}) {
  const name = await companyName(input.companyId);
  const meetLine = input.meetUrl ? ` Google Meet: ${input.meetUrl}` : "";
  const message = `A Google Calendar meeting was scheduled for ${name}.${meetLine}`;

  await Promise.all([
    createNotification({
      recipientUserId: input.founderId,
      actorUserId: input.actorUserId,
      type: "meeting_scheduled_google",
      title: "Meeting scheduled on Google Calendar",
      message,
      entityType: "thread_meeting",
      entityId: input.meetingId,
    }),
    createNotification({
      recipientUserId: input.investorId,
      actorUserId: input.actorUserId,
      type: "meeting_scheduled_google",
      title: "Meeting scheduled on Google Calendar",
      message,
      entityType: "thread_meeting",
      entityId: input.meetingId,
    }),
  ]);
}

export async function notifyMeetingDeclined(input: {
  threadId: string;
  meetingId: string;
  recipientUserId: string;
  actorUserId: string;
  companyId: string;
}) {
  const name = await companyName(input.companyId);

  return createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    type: "meeting_declined",
    title: "Meeting declined",
    message: `A meeting request for ${name} was declined.`,
    entityType: "thread_meeting",
    entityId: input.meetingId,
  });
}

export async function notifyMeetingCanceled(input: {
  threadId: string;
  meetingId: string;
  recipientUserId: string;
  actorUserId: string;
  companyId: string;
}) {
  const name = await companyName(input.companyId);

  return createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    type: "meeting_canceled",
    title: "Meeting canceled",
    message: `A scheduled meeting for ${name} was canceled.`,
    entityType: "thread_meeting",
    entityId: input.meetingId,
  });
}
