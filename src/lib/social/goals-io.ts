/** Read/write helpers for per-period campaign goals and change-alert rules. Server-only. */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Grain, StageGoals } from "./funnel";
import { periodStart, periodKey } from "./funnel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type CampaignGoalRow = {
  campaign_id: string; grain: Grain; period_start: string;
  goal_outreach: number | null; goal_impressions: number | null; goal_clicks: number | null;
  goal_meetings: number | null; goal_conversions: number | null;
};

/** Upsert the goal targets for a campaign, grain and the period containing `when`. */
export async function setCampaignGoals(
  campaignId: string, grain: Grain, goals: StageGoals, when = new Date(), createdBy?: string | null,
): Promise<CampaignGoalRow | null> {
  const ps = periodKey(periodStart(grain, when));
  const norm = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.max(0, Math.round(n)));
  const row = {
    campaign_id: campaignId, grain, period_start: ps,
    goal_outreach: norm(goals.outreach), goal_impressions: norm(goals.impressions), goal_clicks: norm(goals.clicks),
    goal_meetings: norm(goals.meetings), goal_conversions: norm(goals.conversions),
    created_by: createdBy ?? null, updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("social_campaign_goals")
    .upsert(row, { onConflict: "campaign_id,grain,period_start" })
    .select("campaign_id, grain, period_start, goal_outreach, goal_impressions, goal_clicks, goal_meetings, goal_conversions").single();
  if (error) return null;
  return data as CampaignGoalRow;
}

/** Current-period goals for a campaign at a grain (null-filled when unset). */
export async function getCampaignGoals(campaignId: string, grain: Grain, when = new Date()): Promise<StageGoals> {
  const ps = periodKey(periodStart(grain, when));
  const { data } = await db().from("social_campaign_goals")
    .select("goal_outreach, goal_impressions, goal_clicks, goal_meetings, goal_conversions")
    .eq("campaign_id", campaignId).eq("grain", grain).eq("period_start", ps).maybeSingle();
  const g = (data ?? {}) as Record<string, number | null>;
  return { outreach: g.goal_outreach ?? null, impressions: g.goal_impressions ?? null, clicks: g.goal_clicks ?? null, meetings: g.goal_meetings ?? null, conversions: g.goal_conversions ?? null };
}

// ── Alert rules ────────────────────────────────────────────────────────────────

export type AlertRule = {
  id: string; metric: string; direction: "up" | "down" | "behind_pace";
  threshold_pct: number; grain: Grain; channel: "in_app" | "email" | "both";
  campaign_id: string | null; enabled: boolean;
};

export async function listAlertRules(): Promise<AlertRule[]> {
  const { data } = await db().from("social_alert_rules")
    .select("id, metric, direction, threshold_pct, grain, channel, campaign_id, enabled")
    .order("created_at", { ascending: true });
  return ((data ?? []) as AlertRule[]).map((r) => ({ ...r, threshold_pct: Number(r.threshold_pct) }));
}

export async function createAlertRule(input: Omit<AlertRule, "id">, createdBy?: string | null): Promise<AlertRule | null> {
  const { data, error } = await db().from("social_alert_rules")
    .insert({ ...input, threshold_pct: Number(input.threshold_pct) || 10, created_by: createdBy ?? null })
    .select("id, metric, direction, threshold_pct, grain, channel, campaign_id, enabled").single();
  if (error) return null;
  return data as AlertRule;
}

export async function updateAlertRule(id: string, patch: Partial<Omit<AlertRule, "id">>): Promise<boolean> {
  const { error } = await db().from("social_alert_rules").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const { error } = await db().from("social_alert_rules").delete().eq("id", id);
  return !error;
}
