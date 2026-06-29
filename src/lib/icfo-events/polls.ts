import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { logModerationAction } from "@/lib/icfo-events/moderators";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export type EventPoll = {
  id: string;
  question: string;
  options: string[];
  isOpen: boolean;
};

export type PollResults = {
  poll: EventPoll;
  counts: number[];
  total: number;
  myVote: number | null;
};

type PollRow = { id: string; question: string; options: unknown; is_open: boolean };

function mapPoll(r: PollRow): EventPoll {
  return {
    id: r.id,
    question: r.question,
    options: Array.isArray(r.options) ? (r.options as string[]) : [],
    isOpen: r.is_open,
  };
}

export async function createPoll(
  supabase: SupabaseClient<Database>,
  eventId: string,
  question: string,
  options: string[],
  actorId: string,
): Promise<EventPoll> {
  const clean = options.map((o) => o.trim()).filter(Boolean).slice(0, 5);
  const { data, error } = await raw(supabase)
    .from("event_polls")
    .insert({ event_id: eventId, question: question.trim(), options: clean, created_by: actorId, is_open: true })
    .select("id, question, options, is_open")
    .single();
  if (error) throw new Error(error.message);
  await logModerationAction(supabase, { eventId, actorId, action: "open_poll", target: question.slice(0, 80) });
  return mapPoll(data as PollRow);
}

export async function closePoll(
  supabase: SupabaseClient<Database>,
  eventId: string,
  pollId: string,
  actorId: string,
): Promise<void> {
  await raw(supabase).from("event_polls").update({ is_open: false }).eq("id", pollId);
  await logModerationAction(supabase, { eventId, actorId, action: "close_poll", target: pollId });
}

export async function getOpenPoll(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventPoll | null> {
  const { data } = await raw(supabase)
    .from("event_polls")
    .select("id, question, options, is_open")
    .eq("event_id", eventId)
    .eq("is_open", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapPoll(data as PollRow) : null;
}

export async function castVote(
  supabase: SupabaseClient<Database>,
  pollId: string,
  profileId: string,
  optionIndex: number,
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_poll_votes")
    .upsert({ poll_id: pollId, profile_id: profileId, option_index: optionIndex }, { onConflict: "poll_id,profile_id" });
  if (error) throw new Error(error.message);
}

/** Aggregate results (service-role client). myVote requires the viewer id. */
export async function getPollResults(
  supabase: SupabaseClient<Database>,
  poll: EventPoll,
  profileId?: string,
): Promise<PollResults> {
  const { data } = await raw(supabase).from("event_poll_votes").select("option_index, profile_id").eq("poll_id", poll.id);
  const rows = (data ?? []) as { option_index: number; profile_id: string }[];
  const counts = poll.options.map(() => 0);
  let myVote: number | null = null;
  for (const r of rows) {
    if (r.option_index >= 0 && r.option_index < counts.length) counts[r.option_index] += 1;
    if (profileId && r.profile_id === profileId) myVote = r.option_index;
  }
  return { poll, counts, total: rows.length, myVote };
}
