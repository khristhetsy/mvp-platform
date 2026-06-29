import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { logModerationAction } from "@/lib/icfo-events/moderators";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setMute(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
  mute: boolean,
  actorId: string,
): Promise<void> {
  const db = raw(supabase);
  if (mute) {
    await db.from("event_muted_attendees").upsert(
      { event_id: eventId, profile_id: profileId, muted_by: actorId },
      { onConflict: "event_id,profile_id" },
    );
  } else {
    await db.from("event_muted_attendees").delete().eq("event_id", eventId).eq("profile_id", profileId);
  }
  await logModerationAction(supabase, { eventId, actorId, action: mute ? "mute_attendee" : "unmute_attendee", target: profileId });
}

export async function isMuted(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
): Promise<boolean> {
  const { data } = await raw(supabase)
    .from("event_muted_attendees")
    .select("profile_id")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

export async function setBan(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
  ban: boolean,
  permanent: boolean,
  actorId: string,
): Promise<void> {
  const db = raw(supabase);
  if (ban) {
    await db.from("event_banned_attendees").upsert(
      { event_id: eventId, profile_id: profileId, permanent, banned_by: actorId },
      { onConflict: "event_id,profile_id" },
    );
  } else {
    await db.from("event_banned_attendees").delete().eq("event_id", eventId).eq("profile_id", profileId);
  }
  await logModerationAction(supabase, {
    eventId,
    actorId,
    action: ban ? "ban_attendee" : "unban_attendee",
    target: profileId,
    metadata: { permanent },
  });
}

export async function isBanned(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
): Promise<boolean> {
  const { data } = await raw(supabase)
    .from("event_banned_attendees")
    .select("profile_id")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

/** Award a bonus to a set of present attendees, into the existing points ledger. */
export async function awardBonusPoints(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileIds: string[],
  points: number,
  actorId: string,
): Promise<number> {
  const valid = [...new Set(profileIds)].filter((id) => UUID.test(id));
  const amount = Math.max(1, Math.min(500, Math.round(points)));
  if (valid.length === 0) return 0;
  const ref = `drop:${Date.now()}`;
  const rows = valid.map((profile_id) => ({ event_id: eventId, profile_id, action: "bonus", ref, points: amount }));
  const { error } = await raw(supabase)
    .from("event_points")
    .upsert(rows, { onConflict: "event_id,profile_id,action,ref", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  await logModerationAction(supabase, {
    eventId,
    actorId,
    action: "drop_points",
    target: `${valid.length} attendees`,
    metadata: { points: amount },
  });
  return valid.length;
}
