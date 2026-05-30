import type { SupabaseClient } from "@supabase/supabase-js";
import { recordInvestorCrmActivity } from "@/lib/data/investor-crm";
import {
  notifyMeetingAccepted,
  notifyMeetingCanceled,
  notifyMeetingDeclined,
  notifyMeetingRequested,
  notifyMessageReceived,
  notifyThreadCreated,
} from "@/lib/notifications/messaging-events";
import type {
  MessageThreadDetail,
  MessageThreadListItem,
  MessageThreadRecord,
  MessageThreadStatus,
  ThreadMessageRecord,
  ThreadMessageType,
} from "@/lib/messaging/types";
import type { Database } from "@/lib/supabase/types";

const OPEN_STATUSES: MessageThreadStatus[] = ["requested", "active"];

export type EnsureMessageThreadInput = {
  companyId: string;
  founderId: string;
  investorId: string;
  createdBy: string;
  introRequestId?: string | null;
  initialMessageType: ThreadMessageType;
  initialBody: string;
};

export async function ensureMessageThread(
  supabase: SupabaseClient<Database>,
  input: EnsureMessageThreadInput,
) {
  const { data: existing } = await supabase
    .from("message_threads")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("investor_id", input.investorId)
    .in("status", OPEN_STATUSES)
    .maybeSingle();

  if (existing) {
    await appendThreadMessage(supabase, {
      threadId: existing.id,
      senderId: input.createdBy,
      body: input.initialBody,
      messageType: input.initialMessageType,
      bumpThreadActive: true,
    });

    return { data: { thread: existing as MessageThreadRecord, created: false } };
  }

  const now = new Date().toISOString();
  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .insert({
      company_id: input.companyId,
      founder_id: input.founderId,
      investor_id: input.investorId,
      intro_request_id: input.introRequestId ?? null,
      status: "requested",
      created_by: input.createdBy,
      updated_at: now,
    })
    .select("*")
    .single();

  if (threadError || !thread) {
    return { error: threadError ?? new Error("Unable to create message thread.") };
  }

  await appendThreadMessage(supabase, {
    threadId: thread.id,
    senderId: input.createdBy,
    body: input.initialBody,
    messageType: input.initialMessageType,
    bumpThreadActive: false,
  });

  await recordInvestorCrmActivity(supabase, {
    investorId: input.investorId,
    companyId: input.companyId,
    activityType: "message_thread_created",
    metadata: { threadId: thread.id, introRequestId: input.introRequestId ?? null },
  });

  void notifyThreadCreated({
    threadId: thread.id,
    companyId: input.companyId,
    founderId: input.founderId,
    investorId: input.investorId,
    createdBy: input.createdBy,
  });

  return { data: { thread: thread as MessageThreadRecord, created: true } };
}

export async function appendThreadMessage(
  supabase: SupabaseClient<Database>,
  input: {
    threadId: string;
    senderId: string;
    body: string;
    messageType: ThreadMessageType;
    bumpThreadActive?: boolean;
  },
) {
  const { data: message, error } = await supabase
    .from("thread_messages")
    .insert({
      thread_id: input.threadId,
      sender_id: input.senderId,
      body: input.body.trim(),
      message_type: input.messageType,
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  const updates: { updated_at: string; status?: MessageThreadStatus } = {
    updated_at: new Date().toISOString(),
  };

  if (input.bumpThreadActive) {
    const { data: thread } = await supabase
      .from("message_threads")
      .select("status")
      .eq("id", input.threadId)
      .maybeSingle();

    if (thread?.status === "requested") {
      updates.status = "active";
    }
  }

  await supabase.from("message_threads").update(updates).eq("id", input.threadId);

  return { data: message as ThreadMessageRecord };
}

export async function sendUserMessage(
  supabase: SupabaseClient<Database>,
  input: {
    thread: MessageThreadRecord;
    senderId: string;
    body: string;
  },
) {
  const result = await appendThreadMessage(supabase, {
    threadId: input.thread.id,
    senderId: input.senderId,
    body: input.body,
    messageType: "user_message",
    bumpThreadActive: true,
  });

  if (result.error || !result.data) {
    return result;
  }

  await recordInvestorCrmActivity(supabase, {
    investorId: input.thread.investor_id,
    companyId: input.thread.company_id,
    activityType: "message_sent",
    metadata: { threadId: input.thread.id, messageId: result.data.id },
  });

  const recipientId =
    input.senderId === input.thread.founder_id ? input.thread.investor_id : input.thread.founder_id;

  void notifyMessageReceived({
    threadId: input.thread.id,
    recipientUserId: recipientId,
    senderId: input.senderId,
    companyId: input.thread.company_id,
    messageId: result.data.id,
  });

  return result;
}

async function enrichThreadRows(
  supabase: SupabaseClient<Database>,
  threads: MessageThreadRecord[],
): Promise<MessageThreadListItem[]> {
  if (threads.length === 0) {
    return [];
  }

  const companyIds = [...new Set(threads.map((t) => t.company_id))];
  const profileIds = [
    ...new Set(threads.flatMap((t) => [t.founder_id, t.investor_id])),
  ];
  const threadIds = threads.map((t) => t.id);

  const [{ data: companies }, { data: profiles }, { data: messages }, { data: meetings }] =
    await Promise.all([
      supabase.from("companies").select("id, company_name").in("id", companyIds),
      supabase.from("profiles").select("id, full_name, email").in("id", profileIds),
      supabase
        .from("thread_messages")
        .select("thread_id, body, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("thread_meetings")
        .select("thread_id, status, updated_at")
        .in("thread_id", threadIds)
        .order("updated_at", { ascending: false }),
    ]);

  const companyNameById = new Map(
    (companies ?? []).map((c) => [c.id, c.company_name]),
  );
  const profileNameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "User"]),
  );

  const lastMessageByThread = new Map<string, { body: string; created_at: string }>();
  for (const row of messages ?? []) {
    if (!lastMessageByThread.has(row.thread_id)) {
      lastMessageByThread.set(row.thread_id, { body: row.body, created_at: row.created_at });
    }
  }

  const meetingStatusByThread = new Map<string, string>();
  for (const row of meetings ?? []) {
    if (!meetingStatusByThread.has(row.thread_id)) {
      meetingStatusByThread.set(row.thread_id, row.status);
    }
  }

  return threads.map((thread) => {
    const last = lastMessageByThread.get(thread.id);
    return {
      ...thread,
      company_name: companyNameById.get(thread.company_id) ?? null,
      investor_name: profileNameById.get(thread.investor_id) ?? null,
      founder_name: profileNameById.get(thread.founder_id) ?? null,
      last_message_preview: last?.body ?? null,
      last_message_at: last?.created_at ?? thread.updated_at,
      meeting_status: (meetingStatusByThread.get(thread.id) as MessageThreadListItem["meeting_status"]) ?? null,
    };
  });
}

export async function listFounderMessageThreads(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("message_threads")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  const items = await enrichThreadRows(supabase, (data ?? []) as MessageThreadRecord[]);
  return { data: items };
}

export async function listInvestorMessageThreads(
  supabase: SupabaseClient<Database>,
  investorId: string,
) {
  const { data, error } = await supabase
    .from("message_threads")
    .select("*")
    .eq("investor_id", investorId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error };
  }

  const items = await enrichThreadRows(supabase, (data ?? []) as MessageThreadRecord[]);
  return { data: items };
}

export async function listAdminMessageThreads(supabase: SupabaseClient<Database>, limit = 50) {
  const { data, error } = await supabase
    .from("message_threads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { error };
  }

  const items = await enrichThreadRows(supabase, (data ?? []) as MessageThreadRecord[]);
  return { data: items };
}

export async function getMessageThreadDetail(
  supabase: SupabaseClient<Database>,
  threadId: string,
) {
  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError || !thread) {
    return { error: threadError ?? new Error("Thread not found.") };
  }

  const [{ data: company }, { data: profiles }, { data: messages }, { data: meetings }] =
    await Promise.all([
      supabase.from("companies").select("company_name").eq("id", thread.company_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [thread.founder_id, thread.investor_id]),
      supabase
        .from("thread_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true }),
      supabase
        .from("thread_meetings")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false }),
    ]);

  let introRequestMessage: string | null = null;
  if (thread.intro_request_id) {
    const { data: intro } = await supabase
      .from("intro_requests")
      .select("message")
      .eq("id", thread.intro_request_id)
      .maybeSingle();
    introRequestMessage = intro?.message ?? null;
  }

  const profileNameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "User"]),
  );

  const detail: MessageThreadDetail = {
    thread: thread as MessageThreadRecord,
    company_name: company?.company_name ?? null,
    investor_name: profileNameById.get(thread.investor_id) ?? null,
    founder_name: profileNameById.get(thread.founder_id) ?? null,
    messages: (messages ?? []) as ThreadMessageRecord[],
    meetings: (meetings ?? []) as MessageThreadDetail["meetings"],
    intro_request_message: introRequestMessage,
  };

  return { data: detail };
}

export function userCanAccessThread(
  thread: MessageThreadRecord,
  userId: string,
  role: string,
) {
  if (role === "admin" || role === "analyst") {
    return true;
  }
  if (role === "founder") {
    return thread.founder_id === userId;
  }
  if (role === "investor") {
    return thread.investor_id === userId;
  }
  return false;
}
