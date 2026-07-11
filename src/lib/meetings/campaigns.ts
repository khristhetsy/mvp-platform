// Weekly Meeting System — marketing workbook lib (spec §2.4).
// Email campaign schedule (weekly plan) + campaign results with computed conversion rates
// (MR% / PR% / meeting%) and an aggregated ROMI summary. Rates guard divide-by-zero so the
// sheet's #DIV/0! never appears. Read/write via admin routes gated by requireRole.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const rate = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

// ---- Email campaign schedule ----
export interface ScheduleItem {
  id: string; week_start: string; topic: string; audience: string; platform: string;
  scheduled_date: string | null; status: string;
}
export async function listSchedule(): Promise<ScheduleItem[]> {
  const { data } = await db().from("ceo_email_campaign_schedule")
    .select("id, week_start, topic, audience, platform, scheduled_date, status")
    .order("week_start", { ascending: false }).limit(200);
  return (data ?? []) as ScheduleItem[];
}
export interface CreateScheduleInput { week_start: string; topic: string; audience: string; platform?: string; scheduled_date?: string | null }
export async function createScheduleItem(input: CreateScheduleInput, createdBy: string): Promise<string> {
  const { data, error } = await db().from("ceo_email_campaign_schedule").insert({
    week_start: input.week_start, topic: input.topic, audience: input.audience,
    platform: input.platform === "sendgrid" ? "sendgrid" : "resend",
    scheduled_date: input.scheduled_date ?? null, created_by: createdBy,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return String(data.id);
}
export async function updateScheduleItem(id: string, patch: { topic?: string; audience?: string; scheduled_date?: string | null; status?: string }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.topic !== undefined) update.topic = patch.topic;
  if (patch.audience !== undefined) update.audience = patch.audience;
  if (patch.scheduled_date !== undefined) update.scheduled_date = patch.scheduled_date;
  if (patch.status && ["draft", "scheduled", "sent"].includes(patch.status)) update.status = patch.status;
  if (Object.keys(update).length === 0) return;
  const { error } = await db().from("ceo_email_campaign_schedule").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- Campaign results (with computed rates) ----
export interface CampaignResult {
  id: string; strategy: string; run_date: string; agent_name: string | null;
  impressions: number; members_reached: number; positive_replies: number; meetings: number;
  mr_pct: number | null; pr_pct: number | null; meeting_pct: number | null;
}
export async function listCampaignResults(): Promise<CampaignResult[]> {
  const { data } = await db().from("ceo_campaign_results")
    .select("id, strategy, run_date, agent_id, impressions, members_reached, positive_replies, meetings")
    .order("run_date", { ascending: false }).limit(200);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const agentIds = [...new Set(rows.map((r) => r.agent_id).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (agentIds.length) {
    const { data: people } = await db().from("profiles").select("id, full_name, email").in("id", agentIds);
    for (const p of (people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) names.set(p.id, p.full_name ?? p.email ?? "Agent");
  }
  return rows.map((r) => {
    const impressions = Number(r.impressions ?? 0), reached = Number(r.members_reached ?? 0), replies = Number(r.positive_replies ?? 0), meetings = Number(r.meetings ?? 0);
    return {
      id: String(r.id), strategy: String(r.strategy), run_date: String(r.run_date),
      agent_name: r.agent_id ? names.get(String(r.agent_id)) ?? null : null,
      impressions, members_reached: reached, positive_replies: replies, meetings,
      mr_pct: rate(reached, impressions), pr_pct: rate(replies, reached), meeting_pct: rate(meetings, replies),
    };
  });
}
export interface CreateResultInput { strategy: string; run_date: string; agent_id?: string | null; impressions?: number; members_reached?: number; positive_replies?: number; meetings?: number }
export async function createCampaignResult(input: CreateResultInput, createdBy: string): Promise<string> {
  const { data, error } = await db().from("ceo_campaign_results").insert({
    strategy: input.strategy, run_date: input.run_date, agent_id: input.agent_id ?? null,
    impressions: input.impressions ?? 0, members_reached: input.members_reached ?? 0,
    positive_replies: input.positive_replies ?? 0, meetings: input.meetings ?? 0, created_by: createdBy,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

// ---- ROMI summary (aggregated) ----
export interface Romi { impressions: number; members_reached: number; positive_replies: number; meetings: number; mr_pct: number | null; pr_pct: number | null; meeting_pct: number | null }
export async function romiSummary(): Promise<Romi> {
  const { data } = await db().from("ceo_campaign_results").select("impressions, members_reached, positive_replies, meetings");
  const rows = (data ?? []) as Array<{ impressions: number; members_reached: number; positive_replies: number; meetings: number }>;
  const sum = (f: (r: typeof rows[number]) => number) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);
  const impressions = sum((r) => r.impressions), reached = sum((r) => r.members_reached), replies = sum((r) => r.positive_replies), meetings = sum((r) => r.meetings);
  return { impressions, members_reached: reached, positive_replies: replies, meetings, mr_pct: rate(reached, impressions), pr_pct: rate(replies, reached), meeting_pct: rate(meetings, replies) };
}
