// Gamification: points for real participation, badges + leaderboard. Rewards are
// STATUS only — never prizes or money. Awards are written via the service role
// (idempotent on the unique constraint) so they work from any action handler.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function raw(supabase: SupabaseClient): SupabaseClient {
  return supabase;
}

export type PointAction =
  | "register"
  | "session_viewed"
  | "applied"
  | "approved"
  | "networking_optin"
  | "connection_accepted";

/** Code-level defaults — used to seed the DB and as a fallback if a rule row is missing. */
export const POINT_VALUES: Record<PointAction, number> = {
  register: 10,
  session_viewed: 15,
  applied: 20,
  approved: 50,
  networking_optin: 5,
  connection_accepted: 15,
};

export const POINT_ACTION_LABELS: Record<PointAction, string> = {
  register: "Register for an event",
  session_viewed: "Watch a session",
  applied: "Apply to present",
  approved: "Get approved to present",
  networking_optin: "Opt into networking",
  connection_accepted: "Accept a connection",
};

/** Configured point value for an action (falls back to the code default). */
async function resolvePoints(action: PointAction): Promise<number> {
  try {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    const { data } = await raw(admin).from("event_point_rules").select("points").eq("action", action).maybeSingle();
    const configured = (data as { points?: number } | null)?.points;
    return typeof configured === "number" ? configured : POINT_VALUES[action];
  } catch {
    return POINT_VALUES[action];
  }
}

/** Read all point rules (staff config screen). Missing rows fall back to defaults. */
export async function getPointRules(
  supabase: SupabaseClient<Database>,
): Promise<Record<PointAction, number>> {
  const { data } = await raw(supabase as unknown as SupabaseClient).from("event_point_rules").select("action, points");
  const out = { ...POINT_VALUES };
  for (const r of (data ?? []) as Array<{ action: string; points: number }>) {
    if (r.action in out) out[r.action as PointAction] = r.points;
  }
  return out;
}

export async function setPointRule(
  supabase: SupabaseClient<Database>,
  action: PointAction,
  points: number,
): Promise<void> {
  const { error } = await raw(supabase as unknown as SupabaseClient)
    .from("event_point_rules")
    .upsert({ action, points }, { onConflict: "action" });
  if (error) throw new Error(error.message);
}

/**
 * Award points for an action. Idempotent: re-awarding the same
 * (event, member, action, ref) is a no-op. Best-effort — never throws, so it
 * can't break the underlying action.
 */
export async function awardPoints(
  eventId: string,
  profileId: string,
  action: PointAction,
  ref = "",
): Promise<void> {
  try {
    const points = await resolvePoints(action);
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    await raw(admin)
      .from("event_points")
      .upsert(
        { event_id: eventId, profile_id: profileId, action, ref, points },
        { onConflict: "event_id,profile_id,action,ref", ignoreDuplicates: true },
      );
  } catch {
    // swallow — gamification must never block the primary action
  }
}

export interface LeaderboardEntry {
  profileId: string;
  displayName: string;
  points: number;
  rank: number;
}

export interface MemberStats {
  points: number;
  badges: string[];
}

type Row = Record<string, unknown>;

function aggregate(rows: Row[]): Map<string, { points: number; name: string; actions: Set<string> }> {
  const m = new Map<string, { points: number; name: string; actions: Set<string> }>();
  for (const r of rows) {
    const pid = String(r.profile_id);
    const profile = r.profiles as { full_name?: string | null } | null;
    const entry = m.get(pid) ?? { points: 0, name: profile?.full_name ?? "Attendee", actions: new Set<string>() };
    entry.points += Number(r.points ?? 0);
    entry.actions.add(String(r.action));
    if (profile?.full_name) entry.name = profile.full_name;
    m.set(pid, entry);
  }
  return m;
}

/** Top members for an event by total points. Names + totals only. */
export async function getLeaderboard(
  supabase: SupabaseClient<Database>,
  eventId: string,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await raw(supabase as unknown as SupabaseClient)
    .from("event_points")
    .select("profile_id, points, action, profiles:profile_id(full_name)")
    .eq("event_id", eventId);
  if (error) return [];

  const agg = aggregate((data ?? []) as Row[]);
  return [...agg.entries()]
    .map(([profileId, v]) => ({ profileId, displayName: v.name, points: v.points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

function deriveBadges(actions: Set<string>, points: number): string[] {
  const badges: string[] = [];
  if (actions.has("register")) badges.push("Attendee");
  if (actions.has("session_viewed")) badges.push("Viewer");
  if (actions.has("applied")) badges.push("Applicant");
  if (actions.has("approved")) badges.push("Speaker");
  if (actions.has("networking_optin")) badges.push("Networker");
  if (actions.has("connection_accepted")) badges.push("Connector");
  if (points >= 100) badges.push("Gold");
  else if (points >= 50) badges.push("Silver");
  else if (points >= 20) badges.push("Bronze");
  return badges;
}

/** A single member's points + earned badges for an event. */
export async function getMemberStats(
  supabase: SupabaseClient<Database>,
  eventId: string,
  profileId: string,
): Promise<MemberStats> {
  const { data, error } = await raw(supabase as unknown as SupabaseClient)
    .from("event_points")
    .select("action, points")
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  if (error || !data) return { points: 0, badges: [] };

  const rows = data as Row[];
  const points = rows.reduce((s, r) => s + Number(r.points ?? 0), 0);
  const actions = new Set(rows.map((r) => String(r.action)));
  return { points, badges: deriveBadges(actions, points) };
}
