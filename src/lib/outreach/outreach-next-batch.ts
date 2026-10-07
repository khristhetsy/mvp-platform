/**
 * What the next automated outreach batch for a company will be: when it runs,
 * who it goes to, and anything holding it back. Mirrors the gates in
 * processApprovedOutreach (investor-outreach.ts) without changing anything, so
 * the founder can be told ahead of time.
 *
 * Also runs the day-before reminder: notifyUpcomingOutreachBatches() is called
 * from the orchestration cron (twice a day) and emails each founder once per
 * batch, about 24 hours before it goes out.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { emailDispatchAllowedForUser } from "@/lib/organizations/organizations";
import { automatedCeiling, automatedRunLimit, founderCapPeriod, reachedInPeriod } from "@/lib/outreach/investor-cap";
import { loadOutreachGlobals, resolveFounderOutreachConfig, type OutreachGlobals } from "@/lib/outreach/founder-overrides";
import { nextCronSlot, nextOutreachRun } from "@/lib/outreach/outreach-schedule";
import { isOutreachLiveSendEnabled } from "@/lib/outreach/investor-outreach";
import { notifyOutreachUpcoming } from "@/lib/outreach/outreach-notify";
import { getOutreachAutomationEnabled } from "@/lib/settings/platform-settings";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function db(): Db {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export type NextBatchBlock = "unpublished" | "cap_reached" | "no_plan" | null;

export type NextBatch = {
  campaignId: string;
  companyId: string;
  founderId: string;
  runAt: Date;
  /** Queued investors who go first, best match first (names only for founders). */
  investors: Array<{ investorRef: string; name: string; matchScore: number }>;
  /** Most investors this batch can reach (queue may refill from matches). */
  upTo: number;
  /** Something that will stop the batch going out, if anything. */
  blocked: NextBatchBlock;
  periodCap: number | null;
  reachedThisPeriod: number;
  periodResetsAt: Date | null;
  isPublished: boolean;
};

type CampaignRow = { id: string; company_id: string; status: string; paused: boolean; weekly_cap: number; last_run_at: string | null };

async function previewForCampaign(client: Db, campaign: CampaignRow, globals: OutreachGlobals, now: Date): Promise<NextBatch | null> {
  if (campaign.paused) return null;
  const { data: comp } = await client
    .from("companies")
    .select("founder_id, is_published, slug")
    .eq("id", campaign.company_id)
    .maybeSingle();
  const c = comp as { founder_id: string | null; is_published: boolean | null; slug: string | null } | null;
  if (!c?.founder_id) return null;
  // Demo and internal accounts never email investors, so there is nothing to announce.
  if (!(await emailDispatchAllowedForUser(client, c.founder_id))) return null;

  const eff = await resolveFounderOutreachConfig({ id: campaign.company_id, founder_id: c.founder_id }, globals);
  const pausedUntil = eff.pause.enabled ? eff.pause.until : null;
  // An open ended automation pause: no date to give.
  if (eff.pause.enabled && !eff.pause.until) return null;

  const ent = founderEntitlements(eff.planType);
  const period = await founderCapPeriod(client, c.founder_id, now);
  const reached = (await reachedInPeriod(client, campaign.company_id, period.start)).size;
  const periodCap = automatedCeiling({ planCap: ent.investorCap, adminPlanCap: eff.monthlyCap, capOverride: eff.capOverride });
  const limit = automatedRunLimit(periodCap, reached, campaign.weekly_cap);

  let blocked: NextBatchBlock = null;
  let notBefore: Date | null = null;
  if (!ent.canDistribute) blocked = "no_plan";
  else if (limit === 0) {
    blocked = "cap_reached";
    notBefore = period.end;
  }

  const runAt = nextOutreachRun(
    { lastRunAt: campaign.last_run_at, startDate: eff.startDate, pauseUntil: pausedUntil, notBefore },
    now,
  );
  // After the reset the allowance is the full period cap again.
  const upTo = blocked === "cap_reached" ? Math.min(periodCap ?? campaign.weekly_cap, campaign.weekly_cap) : limit;

  const { data: queued } = await client
    .from("investor_outreach_recipients")
    .select("investor_ref, investor_name, match_score")
    .eq("campaign_id", campaign.id)
    .eq("status", "queued")
    .order("match_score", { ascending: false })
    .limit(Math.max(upTo, 1));
  const investors = ((queued ?? []) as Array<{ investor_ref: string; investor_name: string; match_score: number | null }>).map((r) => ({
    investorRef: r.investor_ref,
    name: r.investor_name,
    matchScore: typeof r.match_score === "number" ? r.match_score : 0,
  }));

  const isPublished = Boolean(c.is_published && c.slug);
  if (!blocked && !isPublished) blocked = "unpublished";

  return {
    campaignId: campaign.id,
    companyId: campaign.company_id,
    founderId: c.founder_id,
    runAt,
    investors,
    upTo,
    blocked,
    periodCap,
    reachedThisPeriod: reached,
    periodResetsAt: period.end,
    isPublished,
  };
}

/** The next automated batch for one company, or null when nothing is scheduled to email. */
export async function getNextOutreachBatch(companyId: string, now: Date = new Date()): Promise<NextBatch | null> {
  try {
    if (!(await getOutreachAutomationEnabled())) return null;
    const client = db();
    const { data } = await client
      .from("investor_outreach_campaigns")
      .select("id, company_id, status, paused, weekly_cap, last_run_at")
      .eq("company_id", companyId)
      .in("status", ["pending_approval", "approved", "completed"])
      .maybeSingle();
    if (!data) return null;
    return await previewForCampaign(client, data as CampaignRow, await loadOutreachGlobals(), now);
  } catch {
    return null;
  }
}

const HEADS_UP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Day-before reminder. For every campaign whose next batch runs within 24
 * hours, email and notify the founder once (deduped on the in-app notification
 * for this campaign since its last run). Skipped when sending is off, since
 * nothing would reach investors. Never throws.
 */
export async function notifyUpcomingOutreachBatches(now: Date = new Date()): Promise<{ notified: number }> {
  let notified = 0;
  try {
    if (!(await getOutreachAutomationEnabled())) return { notified };
    const client = db();
    const { data } = await client
      .from("investor_outreach_campaigns")
      .select("id, company_id, status, paused, weekly_cap, last_run_at, created_at")
      .in("status", ["pending_approval", "approved", "completed"])
      .eq("paused", false)
      .not("last_run_at", "is", null);
    const campaigns = (data ?? []) as Array<CampaignRow & { created_at: string }>;
    if (campaigns.length === 0) return { notified };
    const globals = await loadOutreachGlobals();

    for (const campaign of campaigns) {
      try {
        // Cheap pre-check before any per-founder lookups.
        const earliest = new Date(campaign.last_run_at as string).getTime() + 6 * 86_400_000;
        if (earliest - now.getTime() > HEADS_UP_WINDOW_MS) continue;

        const batch = await previewForCampaign(client, campaign, globals, now);
        if (!batch || batch.blocked === "no_plan") continue;
        const until = batch.runAt.getTime() - now.getTime();
        if (until <= 0 || until > HEADS_UP_WINDOW_MS) continue;
        // Nothing queued and nothing can be added: no batch to announce.
        if (batch.investors.length === 0 && batch.upTo === 0) continue;

        const { count } = await client
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_user_id", batch.founderId)
          .eq("type", "outreach_batch_upcoming")
          .eq("entity_id", campaign.id)
          .gt("created_at", campaign.last_run_at as string);
        if ((count ?? 0) > 0) continue;

        await notifyOutreachUpcoming(batch);
        notified += 1;
      } catch {
        /* one campaign must never stop the rest */
      }
    }
  } catch {
    /* reminders never block the cron */
  }
  return { notified };
}

// ── DIY (manual) sequences ───────────────────────────────────────────────────

export type NextManualStep = { label: string; stepIndex: number; runAt: Date; recipients: number };

/**
 * The next DIY sequence step that will send for a company: its label, when the
 * run picks it up, and how many investors it goes to. Null when nothing is
 * queued or live sending is off (nothing would reach investors).
 */
export async function getNextManualOutreachStep(companyId: string, now: Date = new Date()): Promise<NextManualStep | null> {
  try {
    if (!isOutreachLiveSendEnabled()) return null;
    const client = db();
    const { data: camp } = await client
      .from("founder_manual_outreach")
      .select("sequence, status")
      .eq("company_id", companyId)
      .eq("status", "queued")
      .maybeSingle();
    const steps = ((camp as { sequence?: Array<{ label: string; dayOffset: number }> } | null)?.sequence ?? []) as Array<{ label: string; dayOffset: number }>;
    if (!Array.isArray(steps) || steps.length === 0) return null;
    const { data: recs } = await client
      .from("founder_manual_outreach_recipients")
      .select("next_step_index, enrolled_at")
      .eq("company_id", companyId)
      .eq("status", "active");
    const due = new Map<string, NextManualStep>();
    for (const r of (recs ?? []) as Array<{ next_step_index: number; enrolled_at: string }>) {
      const step = steps[r.next_step_index];
      if (!step) continue;
      const dueAt = new Date(new Date(r.enrolled_at).getTime() + (step.dayOffset ?? 0) * 86_400_000);
      const runAt = nextCronSlot(dueAt.getTime() > now.getTime() ? dueAt : now);
      const key = `${runAt.toISOString()}|${r.next_step_index}`;
      const cur = due.get(key);
      if (cur) cur.recipients += 1;
      else due.set(key, { label: step.label, stepIndex: r.next_step_index, runAt, recipients: 1 });
    }
    const next = [...due.values()].sort((a, b) => a.runAt.getTime() - b.runAt.getTime() || b.recipients - a.recipients)[0];
    return next ?? null;
  } catch {
    return null;
  }
}
