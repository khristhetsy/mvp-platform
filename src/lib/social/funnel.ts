/**
 * Four-stage funnel goals + reporting for the Social Media Hub.
 *
 *   Outreach → Clicks → Meetings → Conversions
 *
 * (Impressions was dropped — no platform exposes real per-post reach via API for the
 * current setup, and an estimate wasn't worth showing.)
 *
 * Goals are stored per campaign, per period grain (week/month/quarter/year) and per
 * period_start (social_campaign_goals). Reporting rolls actuals into the same buckets
 * and compares them to the target and to the previous comparable period.
 *
 * Actuals per stage (per campaign, within a period window):
 *   Outreach     = published variants (posts that went out)
 *   Clicks       = social_clicks / fit_sessions carrying the campaign source_tag
 *   Meetings     = scheduling_bookings whose contact's lead_source = source_tag
 *   Conversions  = crm_contacts whose lead_source = source_tag (attributed signups)
 *
 * The pure functions (period math + computeFunnel) are IO-free and unit-tested; the
 * IO fetcher is server-only.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PLAN_PRICES, type PlanType } from "@/lib/subscriptions/plans";

export type Grain = "week" | "month" | "quarter" | "year";
export type StageKey = "outreach" | "clicks" | "meetings" | "conversions";

export const STAGES: StageKey[] = ["outreach", "clicks", "meetings", "conversions"];
export const STAGE_LABELS: Record<StageKey, string> = {
  outreach: "Outreach", clicks: "Clicks", meetings: "Meetings", conversions: "Conversions",
};

/** Paid plans that count toward attributed revenue (mirrors campaigns.ts). */
const PAID_PLANS = new Set<PlanType>(["founder_basic", "founder_professional", "founder_managed_ir", "investor_pro", "investor_premium"]);

// ── Period math (pure) ───────────────────────────────────────────────────────────

/** UTC-safe start of the period containing `d` for the given grain. */
export function periodStart(grain: Grain, d: Date): Date {
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  switch (grain) {
    case "week": {
      // ISO week: Monday as the first day.
      const base = new Date(Date.UTC(y, m, day));
      const dow = (base.getUTCDay() + 6) % 7; // 0 = Monday
      base.setUTCDate(base.getUTCDate() - dow);
      return base;
    }
    case "month": return new Date(Date.UTC(y, m, 1));
    case "quarter": return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
    case "year": return new Date(Date.UTC(y, 0, 1));
  }
}

/** Start of the next period after the one beginning at `start`. */
export function nextPeriodStart(grain: Grain, start: Date): Date {
  const y = start.getUTCFullYear(), m = start.getUTCMonth(), day = start.getUTCDate();
  switch (grain) {
    case "week": { const e = new Date(start); e.setUTCDate(day + 7); return e; }
    case "month": return new Date(Date.UTC(y, m + 1, 1));
    case "quarter": return new Date(Date.UTC(y, m + 3, 1));
    case "year": return new Date(Date.UTC(y + 1, 0, 1));
  }
}

/** Start of the period immediately before the one beginning at `start`. */
export function prevPeriodStart(grain: Grain, start: Date): Date {
  const y = start.getUTCFullYear(), m = start.getUTCMonth(), day = start.getUTCDate();
  switch (grain) {
    case "week": { const e = new Date(start); e.setUTCDate(day - 7); return e; }
    case "month": return new Date(Date.UTC(y, m - 1, 1));
    case "quarter": return new Date(Date.UTC(y, m - 3, 1));
    case "year": return new Date(Date.UTC(y - 1, 0, 1));
  }
}

/** Fraction of the current period that has elapsed by `now` (0..1). */
export function periodElapsed(grain: Grain, start: Date, now: Date): number {
  const end = nextPeriodStart(grain, start).getTime();
  const s = start.getTime();
  return Math.min(1, Math.max(0, (now.getTime() - s) / (end - s)));
}

/** YYYY-MM-DD for a period_start (matches the DATE column). */
export function periodKey(d: Date): string { return d.toISOString().slice(0, 10); }

// ── Funnel computation (pure) ─────────────────────────────────────────────────────

export type StageGoals = Partial<Record<StageKey, number | null>>;
export type StageCounts = Record<StageKey, number>;

export type StageResult = {
  stage: StageKey;
  actual: number;
  target: number | null;
  pctOfGoal: number | null;   // actual / target * 100, null when no target
  prevActual: number;
  deltaPct: number | null;    // change vs previous period, null when prev = 0
  stepFromPrevRatio: number | null; // actual / previous-stage actual (CTR, % booked, % won)
};

/** Round to one decimal for stable display/serialisation. */
function r1(n: number): number { return Math.round(n * 10) / 10; }

/**
 * Combine current actuals, previous-period actuals, and targets into per-stage
 * results with % of goal, vs-previous delta, and step-conversion ratios.
 */
export function computeFunnel(current: StageCounts, previous: StageCounts, goals: StageGoals): StageResult[] {
  return STAGES.map((stage, i) => {
    const actual = current[stage] ?? 0;
    const prevActual = previous[stage] ?? 0;
    const target = goals[stage] ?? null;
    const prevStageActual = i > 0 ? current[STAGES[i - 1]] ?? 0 : 0;
    return {
      stage,
      actual,
      target,
      pctOfGoal: target && target > 0 ? r1((actual / target) * 100) : null,
      prevActual,
      deltaPct: prevActual > 0 ? r1(((actual - prevActual) / prevActual) * 100) : null,
      stepFromPrevRatio: i > 0 && prevStageActual > 0 ? r1((actual / prevStageActual) * 100) / 100 : null,
    };
  });
}

/** Blended % of goal across the stages that have a target (simple mean). */
export function blendedPct(stages: StageResult[]): number | null {
  const withGoal = stages.filter((s) => s.pctOfGoal !== null);
  if (!withGoal.length) return null;
  return r1(withGoal.reduce((a, s) => a + (s.pctOfGoal ?? 0), 0) / withGoal.length);
}

/** Pacing verdict: compare blended attainment to elapsed fraction of the period. */
export function pacing(blended: number | null, elapsed: number): "ahead" | "on_track" | "behind" | null {
  if (blended === null) return null;
  const target = elapsed * 100;
  if (blended >= target + 8) return "ahead";
  if (blended >= target - 8) return "on_track";
  return "behind";
}

// ── IO fetcher (server-only) ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type CampaignFunnel = {
  campaignId: string;
  name: string;
  sourceTag: string;
  grain: Grain;
  periodStart: string;
  stages: StageResult[];
  members: number;
  revenueCents: number;
};

type CampaignRow = { id: string; name: string; source_tag: string };

/** Count published variants per campaign source_tag within [start,end). */
async function outreachByTag(campaigns: CampaignRow[], start: Date, end: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = campaigns.map((c) => c.id);
  if (!ids.length) return out;
  const idToTag = new Map(campaigns.map((c) => [c.id, c.source_tag]));
  const { data: posts } = await db().from("social_posts").select("id, campaign_id").in("campaign_id", ids);
  const postToTag = new Map<string, string>();
  for (const p of (posts ?? []) as { id: string; campaign_id: string }[]) {
    const tag = idToTag.get(p.campaign_id); if (tag) postToTag.set(p.id, tag);
  }
  const postIds = [...postToTag.keys()];
  if (!postIds.length) return out;
  const { data: vars } = await db().from("social_variants")
    .select("post_id, published_at").eq("status", "published")
    .gte("published_at", start.toISOString()).lt("published_at", end.toISOString()).in("post_id", postIds);
  for (const v of (vars ?? []) as { post_id: string }[]) {
    const tag = postToTag.get(v.post_id); if (tag) out.set(tag, (out.get(tag) ?? 0) + 1);
  }
  return out;
}

/** Clicks within [start,end). Prefers real tracked clicks (social_clicks via the
 *  /r/<post> redirect); for tags with no tracked clicks yet, falls back to /fit
 *  sessions so historical posts (published before tracking) still report. */
async function clicksByTag(tags: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!tags.length) return out;
  const { data: clicks } = await db().from("social_clicks").select("source_tag, created_at")
    .in("source_tag", tags).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).limit(200000);
  for (const r of (clicks ?? []) as { source_tag: string | null }[]) {
    const t = r.source_tag ?? ""; if (tags.includes(t)) out.set(t, (out.get(t) ?? 0) + 1);
  }
  // Fallback: only for tags with zero tracked clicks this period.
  const missing = tags.filter((t) => !out.get(t));
  if (missing.length) {
    const { data: sessions } = await db().from("fit_sessions").select("source_tag, created_at")
      .in("source_tag", missing).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).limit(100000);
    for (const r of (sessions ?? []) as { source_tag: string | null }[]) {
      const t = r.source_tag ?? ""; if (missing.includes(t)) out.set(t, (out.get(t) ?? 0) + 1);
    }
  }
  return out;
}

/** Attributed signups + paid members + revenue by tag, filtered to [start,end) by contact creation. */
async function conversionsByTag(tags: string[], start: Date, end: Date): Promise<Map<string, { signups: number; members: number; revenueCents: number }>> {
  const out = new Map<string, { signups: number; members: number; revenueCents: number }>();
  for (const t of tags) out.set(t, { signups: 0, members: 0, revenueCents: 0 });
  if (!tags.length) return out;
  // One indexed lookup per tag, selecting ONLY email. The previous single query pulled
  // the whole `overrides` jsonb for every matching row just to read the tag back out —
  // and since the tag is the thing being filtered on, we already know it. Not selecting
  // `overrides` avoids detoasting a large column per row. See migration 20260912003.
  const rows: Array<{ email: string | null; tag: string }> = [];
  for (const tag of tags) {
    const { data } = await db().from("crm_contacts").select("email")
      .eq("overrides->>lead_source", tag)
      .gte("created_at", start.toISOString()).lt("created_at", end.toISOString())
      .limit(20000);
    for (const r of (data ?? []) as { email: string | null }[]) rows.push({ email: r.email, tag });
  }
  const emails = [...new Set(rows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean))];
  const emailToPlan = new Map<string, PlanType | null>();
  if (emails.length) {
    const { data: profs } = await db().from("profiles").select("id, email").in("email", emails);
    const profRows = (profs ?? []) as { id: string; email: string | null }[];
    const idToEmail = new Map<string, string>();
    for (const p of profRows) if (p.email) idToEmail.set(p.id, p.email.trim().toLowerCase());
    const profIds = profRows.map((p) => p.id);
    if (profIds.length) {
      const { data: subs } = await db().from("subscriptions").select("profile_id, plan_type").in("profile_id", profIds);
      for (const s of (subs ?? []) as { profile_id: string; plan_type: PlanType }[]) {
        const em = idToEmail.get(s.profile_id); if (em) emailToPlan.set(em, s.plan_type);
      }
    }
  }
  for (const r of rows) {
    const b = out.get(r.tag); if (!b) continue;
    b.signups += 1;
    const plan = emailToPlan.get((r.email ?? "").trim().toLowerCase());
    if (plan && PAID_PLANS.has(plan)) { b.members += 1; b.revenueCents += PLAN_PRICES[plan] ?? 0; }
  }
  return out;
}

/** Meetings (bookings) by tag within [start,end), attributed via the contact's lead_source. */
async function meetingsByTag(tags: string[], start: Date, end: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!tags.length) return out;
  // Contacts attributed to these tags → their emails → bookings in-window by email.
  // One indexed lookup per tag, selecting ONLY email: this query has no date bound (a
  // contact attributed last year can book today), so it previously scanned every
  // crm_contacts row and detoasted its `overrides` jsonb — the single most expensive
  // thing the funnel did. See migration 20260912003.
  const emailToTag = new Map<string, string>();
  for (const tag of tags) {
    const { data } = await db().from("crm_contacts").select("email")
      .eq("overrides->>lead_source", tag).limit(20000);
    for (const c of (data ?? []) as { email: string | null }[]) {
      const em = (c.email ?? "").trim().toLowerCase();
      if (em) emailToTag.set(em, tag);
    }
  }
  const emails = [...emailToTag.keys()];
  if (!emails.length) return out;
  const { data: bookings } = await db().from("scheduling_bookings").select("booker_email, created_at")
    .gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).limit(100000);
  for (const b of (bookings ?? []) as { booker_email: string | null }[]) {
    const tag = emailToTag.get((b.booker_email ?? "").trim().toLowerCase());
    if (tag) out.set(tag, (out.get(tag) ?? 0) + 1);
  }
  return out;
}

async function countsFor(campaigns: CampaignRow[], tags: string[], start: Date, end: Date): Promise<Map<string, StageCounts>> {
  const [outreach, clicks, meetings, conv] = await Promise.all([
    outreachByTag(campaigns, start, end),
    clicksByTag(tags, start, end),
    meetingsByTag(tags, start, end),
    conversionsByTag(tags, start, end),
  ]);
  const byTag = new Map<string, StageCounts>();
  for (const t of tags) {
    byTag.set(t, {
      outreach: outreach.get(t) ?? 0,
      clicks: clicks.get(t) ?? 0,
      meetings: meetings.get(t) ?? 0,
      conversions: conv.get(t)?.signups ?? 0,
    });
  }
  return byTag;
}

/** Per-campaign funnel for the period containing `now` at the given grain. */
export async function campaignFunnels(grain: Grain, now = new Date()): Promise<CampaignFunnel[]> {
  const { data } = await db().from("social_campaigns").select("id, name, source_tag").is("archived_at", null).order("created_at", { ascending: false });
  const campaigns = (data ?? []) as CampaignRow[];
  if (!campaigns.length) return [];
  const tags = campaigns.map((c) => c.source_tag);
  const start = periodStart(grain, now);
  const end = nextPeriodStart(grain, start);
  const prevStart = prevPeriodStart(grain, start);

  const [cur, prev, goalsRows, convCur] = await Promise.all([
    countsFor(campaigns, tags, start, end),
    countsFor(campaigns, tags, prevStart, start),
    db().from("social_campaign_goals").select("campaign_id, goal_outreach, goal_clicks, goal_meetings, goal_conversions").eq("grain", grain).eq("period_start", periodKey(start)),
    conversionsByTag(tags, start, end),
  ]);
  const goalsByCampaign = new Map<string, StageGoals>();
  for (const g of ((goalsRows.data ?? []) as Record<string, number | null>[])) {
    goalsByCampaign.set(String(g.campaign_id), {
      outreach: g.goal_outreach, clicks: g.goal_clicks, meetings: g.goal_meetings, conversions: g.goal_conversions,
    });
  }

  const zero: StageCounts = { outreach: 0, clicks: 0, meetings: 0, conversions: 0 };
  return campaigns.map((c) => {
    const conv = convCur.get(c.source_tag) ?? { signups: 0, members: 0, revenueCents: 0 };
    return {
      campaignId: c.id,
      name: c.name,
      sourceTag: c.source_tag,
      grain,
      periodStart: periodKey(start),
      stages: computeFunnel(cur.get(c.source_tag) ?? zero, prev.get(c.source_tag) ?? zero, goalsByCampaign.get(c.id) ?? {}),
      members: conv.members,
      revenueCents: conv.revenueCents,
    };
  });
}

/** Sum per-campaign funnels into one blended funnel across all campaigns (Overview). */
export function aggregateFunnels(funnels: CampaignFunnel[]): StageResult[] {
  const cur: StageCounts = { outreach: 0, clicks: 0, meetings: 0, conversions: 0 };
  const prev: StageCounts = { outreach: 0, clicks: 0, meetings: 0, conversions: 0 };
  const goals: Record<StageKey, number> = { outreach: 0, clicks: 0, meetings: 0, conversions: 0 };
  const hasGoal: Record<StageKey, boolean> = { outreach: false, clicks: false, meetings: false, conversions: false };
  for (const f of funnels) for (const s of f.stages) {
    cur[s.stage] += s.actual; prev[s.stage] += s.prevActual;
    if (s.target !== null) { goals[s.stage] += s.target; hasGoal[s.stage] = true; }
  }
  const g: StageGoals = {};
  for (const s of STAGES) g[s] = hasGoal[s] ? goals[s] : null;
  return computeFunnel(cur, prev, g);
}
