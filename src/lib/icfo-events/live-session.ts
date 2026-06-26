// Live session interaction: Q&A (upvotable) + chat. Server loaders for initial
// render; live updates happen client-side via Supabase Realtime.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export interface SessionQuestion {
  id: string;
  sessionId: string;
  profileId: string;
  authorName: string;
  body: string;
  isAnswered: boolean;
  upvotes: number;
  votedByMe: boolean;
  createdAt: string;
}

export interface SessionChatMessage {
  id: string;
  sessionId: string;
  profileId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export async function loadSessionQuestions(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  myId: string,
): Promise<SessionQuestion[]> {
  const [{ data: qData }, { data: vData }] = await Promise.all([
    raw(supabase)
      .from("session_questions")
      .select("*, profiles:profile_id(full_name)")
      .eq("session_id", sessionId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true }),
    raw(supabase).from("session_question_votes").select("question_id, profile_id").eq("session_id", sessionId),
  ]);

  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const v of (vData ?? []) as Row[]) {
    const qid = String(v.question_id);
    counts.set(qid, (counts.get(qid) ?? 0) + 1);
    if (String(v.profile_id) === myId) mine.add(qid);
  }

  return ((qData ?? []) as Row[]).map((r) => {
    const profile = r.profiles as { full_name?: string | null } | null;
    const id = String(r.id);
    return {
      id,
      sessionId: String(r.session_id),
      profileId: String(r.profile_id),
      authorName: profile?.full_name ?? "Attendee",
      body: String(r.body),
      isAnswered: Boolean(r.is_answered),
      upvotes: counts.get(id) ?? 0,
      votedByMe: mine.has(id),
      createdAt: String(r.created_at),
    };
  });
}

export type GuestStatus = "backstage" | "onstage";

export interface SessionGuest {
  id: string;
  sessionId: string;
  displayName: string;
  roleLabel: string | null;
  status: GuestStatus;
}

export function mapSessionGuest(r: Row): SessionGuest {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    displayName: String(r.display_name),
    roleLabel: (r.role_label as string | null) ?? null,
    status: r.status as GuestStatus,
  };
}

export async function loadSessionGuests(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<SessionGuest[]> {
  const { data } = await raw(supabase)
    .from("session_guests")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  return ((data ?? []) as Row[]).map(mapSessionGuest);
}

export type CallInStatus = "requested" | "invited" | "onstage" | "done";

export interface CallInEntry {
  id: string;
  profileId: string;
  name: string;
  status: CallInStatus;
  createdAt: string;
}

/** Host sees the full queue; an attendee sees only their own hand. */
export async function loadCallInQueue(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  myId: string,
  isStaff: boolean,
): Promise<CallInEntry[]> {
  let q = raw(supabase)
    .from("session_callin_queue")
    .select("*, profiles:profile_id(full_name)")
    .eq("session_id", sessionId)
    .neq("status", "done")
    .order("created_at", { ascending: true });
  if (!isStaff) q = q.eq("profile_id", myId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map((r) => {
    const profile = r.profiles as { full_name?: string | null } | null;
    return {
      id: String(r.id),
      profileId: String(r.profile_id),
      name: profile?.full_name ?? "Attendee",
      status: r.status as CallInStatus,
      createdAt: String(r.created_at),
    };
  });
}

export async function loadSessionChat(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  limit = 50,
): Promise<SessionChatMessage[]> {
  const { data } = await raw(supabase)
    .from("session_chat_messages")
    .select("*, profiles:profile_id(full_name)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[])
    .map((r) => {
      const profile = r.profiles as { full_name?: string | null } | null;
      return {
        id: String(r.id),
        sessionId: String(r.session_id),
        profileId: String(r.profile_id),
        authorName: profile?.full_name ?? "Attendee",
        body: String(r.body),
        createdAt: String(r.created_at),
      };
    })
    .reverse();
}
