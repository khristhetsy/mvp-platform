import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendEmail } from "@/lib/email/send-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// email_threads / email_messages aren't in the generated types yet — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export interface EmailThread {
  id: string;
  owner_id: string;
  subject: string | null;
  contact_email: string;
  contact_name: string | null;
  reply_token: string;
  last_message_at: string;
  last_direction: "outbound" | "inbound" | null;
  unread: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  owner_id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  provider_id: string | null;
  created_at: string;
}

const THREAD_COLS =
  "id, owner_id, subject, contact_email, contact_name, reply_token, last_message_at, last_direction, unread, created_at, updated_at";
const MSG_COLS =
  "id, thread_id, owner_id, direction, from_email, from_name, to_email, subject, body_text, body_html, provider_id, created_at";

export function inboundDomain(): string {
  return process.env.INBOUND_EMAIL_DOMAIN ?? "mail.capitalos.io";
}

/** The plus-addressed reply target that routes inbound mail back to a thread. */
export function replyAddress(token: string): string {
  return `reply+${token}@${inboundDomain()}`;
}

function htmlFromText(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
}

export type ThreadListItem = EmailThread & { snippet: string | null };
export type MailFolder = "inbox" | "sent" | "all" | "trash";

export function isMailFolder(v: string): v is MailFolder {
  return v === "inbox" || v === "sent" || v === "all" || v === "trash";
}

export async function listThreads(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  folder: MailFolder = "inbox",
): Promise<ThreadListItem[]> {
  let query = raw(supabase).from("email_threads").select(THREAD_COLS).eq("owner_id", ownerId);
  if (folder === "trash") {
    query = query.not("trashed_at", "is", null);
  } else {
    query = query.is("trashed_at", null);
    // Inbox = received or brand-new; Sent = you sent last. All = both.
    if (folder === "inbox") query = query.or("last_direction.is.null,last_direction.eq.inbound");
    else if (folder === "sent") query = query.eq("last_direction", "outbound");
  }
  const { data } = await query.order("last_message_at", { ascending: false }).limit(200);
  const threads = (data ?? []) as EmailThread[];
  if (threads.length === 0) return [];

  // Latest message body per thread → preview snippet (single query).
  const ids = threads.map((t) => t.id);
  const { data: msgs } = await raw(supabase)
    .from("email_messages")
    .select("thread_id, body_text, created_at")
    .in("thread_id", ids)
    .order("created_at", { ascending: false });

  const snippetByThread = new Map<string, string>();
  for (const m of (msgs ?? []) as Array<{ thread_id: string; body_text: string | null }>) {
    if (!snippetByThread.has(m.thread_id) && m.body_text) {
      snippetByThread.set(m.thread_id, m.body_text.replace(/\s+/g, " ").trim().slice(0, 140));
    }
  }
  return threads.map((t) => ({ ...t, snippet: snippetByThread.get(t.id) ?? null }));
}

export async function setThreadUnread(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  threadId: string,
  unread: boolean,
): Promise<void> {
  await raw(supabase)
    .from("email_threads")
    .update({ unread, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("owner_id", ownerId);
}

export async function getThread(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  threadId: string,
): Promise<{ thread: EmailThread; messages: EmailMessage[] } | null> {
  const { data: threadRow } = await raw(supabase)
    .from("email_threads")
    .select(THREAD_COLS)
    .eq("id", threadId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!threadRow) return null;

  const { data: msgs } = await raw(supabase)
    .from("email_messages")
    .select(MSG_COLS)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return { thread: threadRow as EmailThread, messages: (msgs ?? []) as EmailMessage[] };
}

interface Owner {
  id: string;
  email: string | null;
  name: string | null;
}

/** Insert an outbound message on a thread and send it (best-effort). */
async function sendOnThread(
  supabase: SupabaseClient<Database>,
  owner: Owner,
  thread: EmailThread,
  subject: string | null,
  body: string,
): Promise<void> {
  const html = htmlFromText(body);
  const sent = await sendEmail({
    to: thread.contact_email,
    subject: subject ?? "(no subject)",
    html,
    text: body,
    replyTo: replyAddress(thread.reply_token),
    fromName: owner.name ?? owner.email ?? undefined,
  });

  const now = new Date().toISOString();
  await raw(supabase).from("email_messages").insert({
    thread_id: thread.id,
    owner_id: owner.id,
    direction: "outbound",
    from_email: owner.email ?? "you",
    from_name: owner.name,
    to_email: thread.contact_email,
    subject,
    body_text: body,
    body_html: html,
    provider_id: sent ? "resend" : null,
  });
  await raw(supabase)
    .from("email_threads")
    .update({ last_message_at: now, last_direction: "outbound", unread: false, updated_at: now })
    .eq("id", thread.id);
}

export async function composeThread(
  supabase: SupabaseClient<Database>,
  owner: Owner,
  input: { to: string; toName?: string | null; subject: string; body: string },
): Promise<EmailThread> {
  const token = randomBytes(12).toString("hex");
  const now = new Date().toISOString();
  const { data, error } = await raw(supabase)
    .from("email_threads")
    .insert({
      owner_id: owner.id,
      subject: input.subject,
      contact_email: input.to.toLowerCase(),
      contact_name: input.toName ?? null,
      reply_token: token,
      last_message_at: now,
      last_direction: "outbound",
      unread: false,
    })
    .select(THREAD_COLS)
    .single();
  if (error) throw new Error(error.message ?? "Unable to start thread.");

  const thread = data as EmailThread;
  await sendOnThread(supabase, owner, thread, input.subject, input.body);
  return thread;
}

export async function replyToThread(
  supabase: SupabaseClient<Database>,
  owner: Owner,
  threadId: string,
  body: string,
): Promise<EmailMessage[]> {
  const existing = await getThread(supabase, owner.id, threadId);
  if (!existing) throw new Error("Thread not found.");
  const subject = existing.thread.subject ? `Re: ${existing.thread.subject.replace(/^Re:\s*/i, "")}` : null;
  await sendOnThread(supabase, owner, existing.thread, subject, body);
  const refreshed = await getThread(supabase, owner.id, threadId);
  return refreshed?.messages ?? [];
}

export async function countUnreadThreads(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<number> {
  const { count } = await raw(supabase)
    .from("email_threads")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("unread", true)
    .is("trashed_at", null);
  return count ?? 0;
}

/** Move a thread to Trash (soft delete). Reversible via restoreThread. */
export async function trashThread(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  threadId: string,
): Promise<void> {
  await raw(supabase)
    .from("email_threads")
    .update({ trashed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("owner_id", ownerId);
}

/** Restore a thread out of Trash. */
export async function restoreThread(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  threadId: string,
): Promise<void> {
  await raw(supabase)
    .from("email_threads")
    .update({ trashed_at: null, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("owner_id", ownerId);
}

/**
 * Permanently delete a conversation and its messages (cascade). Ownership is
 * enforced by the owner_id filter; uses the service-role client since the table
 * has no delete RLS policy.
 */
export async function deleteThread(ownerId: string, threadId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await raw(admin)
    .from("email_threads")
    .delete()
    .eq("id", threadId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message ?? "Unable to delete conversation.");
}

export async function markThreadRead(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  threadId: string,
): Promise<void> {
  await raw(supabase)
    .from("email_threads")
    .update({ unread: false, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("owner_id", ownerId);
}

/**
 * Record an inbound reply (called by the webhook with the service-role client).
 * Routes by reply_token; ignores mail for unknown tokens.
 */
export async function recordInboundMessage(
  admin: SupabaseClient<Database>,
  input: { token: string; fromEmail: string; fromName?: string | null; subject?: string | null; text?: string | null; html?: string | null },
): Promise<{ matched: boolean }> {
  const { data: threadRow } = await raw(admin)
    .from("email_threads")
    .select(THREAD_COLS)
    .eq("reply_token", input.token)
    .maybeSingle();
  if (!threadRow) return { matched: false };
  const thread = threadRow as EmailThread;

  const now = new Date().toISOString();
  await raw(admin).from("email_messages").insert({
    thread_id: thread.id,
    owner_id: thread.owner_id,
    direction: "inbound",
    from_email: input.fromEmail.toLowerCase(),
    from_name: input.fromName ?? null,
    to_email: replyAddress(thread.reply_token),
    subject: input.subject ?? thread.subject,
    body_text: input.text ?? null,
    body_html: input.html ?? null,
  });
  await raw(admin)
    .from("email_threads")
    .update({ last_message_at: now, last_direction: "inbound", unread: true, updated_at: now })
    .eq("id", thread.id);

  return { matched: true };
}
