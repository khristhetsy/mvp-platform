/**
 * What is already pointing at an event, or at a live session.
 *
 * A confirmation that only asks "are you sure?" tells nobody anything. These
 * counts are what make the decision real: how many registrations hold the old
 * date, how many people are watching the session about to end.
 *
 * Every count is read independently and defaults to null on failure — a
 * dialog showing a dash is honest, one showing a confident 0 is not.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

async function countOf(
  table: string,
  build: (q: ReturnType<SupabaseClient["from"]>) => unknown,
): Promise<number | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = raw().from(table).select("id", { count: "exact", head: true }) as any;
    const { count, error } = await (build(q) as Promise<{ count: number | null; error: unknown }>);
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

export type EventImpact = {
  registrations: number | null;
  sessions: number | null;
  liveSessions: number | null;
  scheduledEmails: number | null;
  publishedBooklets: number | null;
};

/** What a date change or an ending would reach. */
export async function eventImpact(eventId: string): Promise<EventImpact> {
  const [registrations, sessions, liveSessions, scheduledEmails, publishedBooklets] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countOf("registrations", (q: any) => q.eq("event_id", eventId)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countOf("sessions", (q: any) => q.eq("event_id", eventId).neq("status", "draft")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countOf("sessions", (q: any) => q.eq("event_id", eventId).eq("status", "live")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countOf("marketing_campaigns", (q: any) => q.eq("linked_event_id", eventId).eq("status", "scheduled")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countOf("event_brochures", (q: any) => q.eq("event_id", eventId).eq("published", true)),
  ]);
  return { registrations, sessions, liveSessions, scheduledEmails, publishedBooklets };
}

export type SessionImpact = {
  /** Hands raised and not yet brought on stage. */
  queued: number | null;
  /** People billed under this session — guest CEO, investor, presenters. */
  billed: number | null;
  /** True once a recording has been uploaded for this session. */
  recorded: boolean | null;
};

/** Whether anything has been captured — a session ended with nothing recorded
 *  leaves no trace at all, which is worth saying before it happens. */
async function sessionRecorded(sessionId: string): Promise<boolean | null> {
  try {
    const { data, error } = await raw()
      .from("sessions")
      .select("recording_path")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return null;
    // `recording_url` is on voice_live_calls, not here — sessions store a path.
    const r = data as { recording_path?: string | null } | null;
    return Boolean(r?.recording_path);
  } catch {
    return null;
  }
}

/** What ending one session would interrupt. */
export async function sessionImpact(sessionId: string): Promise<SessionImpact> {
  const [queued, billed] = await Promise.all([
    // Waiting, not yet invited or on stage — the ones a sudden end strands.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countOf("session_callin_queue", (q: any) => q.eq("session_id", sessionId).in("status", ["requested", "invited"])),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countOf("event_presenters", (q: any) => q.eq("session_id", sessionId)),
  ]);
  return { queued, billed, recorded: await sessionRecorded(sessionId) };
}
