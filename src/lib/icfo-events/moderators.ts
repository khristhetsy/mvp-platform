import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { PRESENCE_ROOMS } from "./venue";

/** Loose client — the moderator tables aren't in generated types yet. */
function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

const ALL_ROOMS = "*";

export type EventModerator = {
  userId: string;
  name: string;
  email: string | null;
  rooms: string[];
  assignedAt: string;
};

export type ModerationAction =
  | "assign_moderator"
  | "remove_moderator"
  | "broadcast"
  | "move_attendee"
  | "remove_attendee"
  | "mute_attendee"
  | "unmute_attendee"
  | "ban_attendee"
  | "unban_attendee"
  | "drop_points"
  | "open_poll"
  | "close_poll"
  | "start_session"
  | "end_session";

/** Does this moderator's room scope cover the given room? */
export function canModerateRoom(rooms: string[], room: string): boolean {
  return rooms.includes(ALL_ROOMS) || rooms.includes(room);
}

/** Keep only valid room names; collapse an "all rooms" selection to ['*']. */
export function normalizeRooms(input: string[]): string[] {
  if (input.includes(ALL_ROOMS) || input.includes("All rooms")) return [ALL_ROOMS];
  const valid = input.filter((r) => (PRESENCE_ROOMS as readonly string[]).includes(r));
  return Array.from(new Set(valid));
}

type ModRow = {
  user_id: string;
  rooms: string[] | null;
  assigned_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export async function listEventModerators(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventModerator[]> {
  const { data, error } = await raw(supabase)
    .from("event_moderators")
    .select("user_id, rooms, assigned_at, profiles:user_id(full_name, email)")
    .eq("event_id", eventId)
    .order("assigned_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ModRow[]).map((r) => ({
    userId: r.user_id,
    rooms: r.rooms ?? [],
    assignedAt: r.assigned_at,
    name: r.profiles?.full_name ?? r.profiles?.email ?? "Staff",
    email: r.profiles?.email ?? null,
  }));
}

export async function assignEventModerator(
  supabase: SupabaseClient<Database>,
  eventId: string,
  userId: string,
  rooms: string[],
  actorId: string,
): Promise<void> {
  const normalized = normalizeRooms(rooms);
  const { error } = await raw(supabase).from("event_moderators").upsert(
    {
      event_id: eventId,
      user_id: userId,
      rooms: normalized,
      assigned_by: actorId,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" },
  );
  if (error) throw new Error(error.message);
  await logModerationAction(supabase, {
    eventId,
    actorId,
    action: "assign_moderator",
    target: userId,
    metadata: { rooms: normalized },
  });
}

export async function removeEventModerator(
  supabase: SupabaseClient<Database>,
  eventId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_moderators")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  await logModerationAction(supabase, { eventId, actorId, action: "remove_moderator", target: userId });
}

export async function logModerationAction(
  supabase: SupabaseClient<Database>,
  entry: { eventId: string; actorId: string; action: ModerationAction; target?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  await raw(supabase).from("event_moderation_log").insert({
    event_id: entry.eventId,
    actor_id: entry.actorId,
    action: entry.action,
    target: entry.target ?? null,
    metadata: entry.metadata ?? {},
  });
}
