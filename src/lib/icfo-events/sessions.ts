// Admin session management (recorded sessions for Phase 1).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SessionInput } from "./schemas";
import type { EventSession } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

function mapSession(r: Row): EventSession {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    sectorSlug: (r.sector_slug as string | null) ?? null,
    title: String(r.title),
    abstract: (r.abstract as string | null) ?? null,
    type: r.type as EventSession["type"],
    status: r.status as EventSession["status"],
    startsAt: (r.starts_at as string | null) ?? null,
    endsAt: (r.ends_at as string | null) ?? null,
    videoProvider: (r.video_provider as string | null) ?? null,
    videoRef: (r.video_ref as string | null) ?? null,
    recordingPath: (r.recording_path as string | null) ?? null,
    hostSponsorId: (r.host_sponsor_id as string | null) ?? null,
    position: Number(r.position ?? 0),
  };
}

export async function createSession(
  supabase: SupabaseClient<Database>,
  eventId: string,
  input: SessionInput,
): Promise<EventSession> {
  const { data, error } = await raw(supabase)
    .from("sessions")
    .insert({
      event_id: eventId,
      title: input.title,
      abstract: input.abstract ?? null,
      type: input.type,
      status: input.status,
      sector_slug: input.sectorSlug ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      recording_path: input.recordingPath ?? null,
      host_sponsor_id: input.hostSponsorId ?? null,
      position: input.position,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data as Row);
}

export async function updateSession(
  supabase: SupabaseClient<Database>,
  id: string,
  input: Partial<SessionInput>,
): Promise<EventSession> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.abstract !== undefined) patch.abstract = input.abstract;
  if (input.type !== undefined) patch.type = input.type;
  if (input.status !== undefined) patch.status = input.status;
  if (input.sectorSlug !== undefined) patch.sector_slug = input.sectorSlug;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
  if (input.recordingPath !== undefined) patch.recording_path = input.recordingPath;
  if (input.hostSponsorId !== undefined) patch.host_sponsor_id = input.hostSponsorId;
  if (input.position !== undefined) patch.position = input.position;
  const { data, error } = await raw(supabase)
    .from("sessions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data as Row);
}

export async function deleteSession(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await raw(supabase).from("sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Persist a new running order. `orderedIds` is the desired top-to-bottom order;
 *  each session's `position` is set to its index. Scoped to the event for safety. */
export async function reorderSessions(
  supabase: SupabaseClient<Database>,
  eventId: string,
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      raw(supabase).from("sessions").update({ position: index }).eq("id", id).eq("event_id", eventId),
    ),
  );
}

/** Attach a live room to a session and mark it live. */
export async function setSessionLiveRoom(
  supabase: SupabaseClient<Database>,
  id: string,
  provider: string,
  ref: string,
): Promise<EventSession> {
  const { data, error } = await raw(supabase)
    .from("sessions")
    .update({ video_provider: provider, video_ref: ref, status: "live" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data as Row);
}

/** End a live session (status → ended). The room URL stays for reference. */
export async function endLiveSession(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<EventSession> {
  const { data, error } = await raw(supabase)
    .from("sessions")
    .update({ status: "ended" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data as Row);
}
