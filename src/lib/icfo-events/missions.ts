// Gamification missions: named action sets that earn a bonus when completed
// within an event. Completion is derived from the member's event_points actions.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export interface Mission {
  id: string;
  title: string;
  description: string | null;
  requiredActions: string[];
  bonusPoints: number;
  isActive: boolean;
}

export interface MissionProgress extends Mission {
  completedActions: string[];
  done: boolean;
}

function mapMission(r: Row): Mission {
  return {
    id: String(r.id),
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    requiredActions: Array.isArray(r.required_actions) ? (r.required_actions as string[]) : [],
    bonusPoints: Number(r.bonus_points ?? 0),
    isActive: Boolean(r.is_active),
  };
}

export async function listMissions(
  supabase: SupabaseClient<Database>,
  activeOnly = false,
): Promise<Mission[]> {
  let q = raw(supabase).from("event_missions").select("*").order("created_at", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMission);
}

export async function createMission(
  supabase: SupabaseClient<Database>,
  input: { title: string; description?: string | null; requiredActions: string[]; bonusPoints: number },
): Promise<Mission> {
  const { data, error } = await raw(supabase)
    .from("event_missions")
    .insert({
      title: input.title,
      description: input.description ?? null,
      required_actions: input.requiredActions,
      bonus_points: input.bonusPoints,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapMission(data as Row);
}

export async function setMissionActive(
  supabase: SupabaseClient<Database>,
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await raw(supabase).from("event_missions").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Compute a member's mission progress for an event from the actions they've
 * recorded in event_points, and award the bonus (once) for any newly completed
 * mission. Idempotent via the event_points unique constraint.
 */
export async function getMissionProgress(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
): Promise<MissionProgress[]> {
  const missions = await listMissions(supabase, true);
  if (missions.length === 0) return [];

  const { data: ptRows } = await raw(supabase)
    .from("event_points")
    .select("action")
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  const actions = new Set(((ptRows ?? []) as Row[]).map((r) => String(r.action)));

  const progress = missions.map((m) => {
    const completedActions = m.requiredActions.filter((a) => actions.has(a));
    const done = m.requiredActions.length > 0 && completedActions.length === m.requiredActions.length;
    return { ...m, completedActions, done };
  });

  // Award bonuses for completed missions (best-effort, idempotent).
  const newlyDone = progress.filter((p) => p.done && p.bonusPoints > 0);
  if (newlyDone.length > 0) {
    try {
      const admin = createServiceRoleClient() as unknown as SupabaseClient;
      await admin.from("event_points").upsert(
        newlyDone.map((p) => ({
          event_id: eventId,
          profile_id: profileId,
          action: "mission_complete",
          ref: p.id,
          points: p.bonusPoints,
        })),
        { onConflict: "event_id,profile_id,action,ref", ignoreDuplicates: true },
      );
    } catch {
      /* swallow — never block the page */
    }
  }

  return progress;
}
