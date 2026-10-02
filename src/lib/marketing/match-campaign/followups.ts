/**
 * Match campaign follow up sequence, server side: cohort and holdout
 * assignment at send time, the follow up runner (cron), investor profile view
 * tracking, the manual Replied mark, and the split test results.
 *
 * Self contained on match_campaign_founders: the generic marketing sequence
 * engine (marketing_sequences) is not used or changed. Nothing here runs
 * unless MATCH_SEQUENCE_ENABLED=true and the campaign has the sequence on.
 * Server only.
 */
import { marketingDb } from "@/lib/marketing/db";
import { emailConfigured, makeUnsubscribeToken, sendMarketingEmail } from "@/lib/marketing/send";
import { isUnsubscribed } from "@/lib/marketing/contacts";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { renderSubject, DEFAULT_SUBJECT } from "./email";
import { stageLabel } from "./fields";
import { sequenceActive } from "./flag";
import { getMatchCampaign, investorNames, type MatchCampaignRow } from "./store";
import { makeFounderToken } from "./token";
import {
  callTaskText,
  cohortKeys,
  decideFollowup,
  followupSubject,
  renderFollowupEmail,
  variantFor,
  type FollowupBranch,
  type FollowupState,
  type StopReason,
} from "./sequence";

const DAY = 24 * 60 * 60 * 1000;
const PAID_PLANS = ["founder_basic", "founder_professional", "founder_managed_ir"];
/** Founders handled per cron pass, across campaigns. */
const RUN_LIMIT = 200;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

function postalAddress(): string {
  return process.env.MARKETING_POSTAL_ADDRESS?.trim() || "iCFO Capital Global, Inc., La Jolla, CA";
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Message-ID we set on Day 0 so follow ups can reply in the same thread. */
export function threadMessageId(campaignFounderId: string, fromEmail: string): string {
  const domain = fromEmail.split("@")[1]?.trim() || "icapos.com";
  return `<mc-${campaignFounderId}@${domain}>`;
}

// ── Cohorts ─────────────────────────────────────────────────────────────────

type CohortRow = { id: string; founder_contact_id: string; industry: string | null; funding_stage: string | null; cohort_key: string | null; variant: string | null };

async function countries(contactIds: readonly string[]): Promise<Map<string, string | null>> {
  const db = marketingDb();
  const out = new Map<string, string | null>();
  for (const part of chunk([...new Set(contactIds)], 200)) {
    const { data } = await db.from("match_campaign_founder_fields").select("id, country").in("id", part);
    for (const r of (data ?? []) as Array<{ id: string; country: string | null }>) out.set(r.id, r.country);
  }
  return out;
}

/** Founders that will be emailed: data check passed, matched, not yet sent. */
async function readyFounders(campaignId: string): Promise<CohortRow[]> {
  const db = marketingDb();
  const rows: CohortRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("match_campaign_founders")
      .select("id, founder_contact_id, industry, funding_stage, cohort_key, variant")
      .eq("campaign_id", campaignId)
      .eq("send_status", "pending")
      .is("excluded_reason", null)
      .gt("match_count", 0)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as CohortRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

export type CohortSummaryRow = { key: string; founders: number; avgMatches: number; sequence: number; single: number; excluded: boolean };

/** Cohorts as they will be assigned at send time. Read only. */
export async function cohortSummary(campaignId: string): Promise<{ cohorts: CohortSummaryRow[]; cap: number; holdoutPct: number }> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  const cfg = campaign.match_config;
  const ready = await readyFounders(campaignId);
  const country = await countries(ready.map((r) => r.founder_contact_id));
  const keys = cohortKeys(
    ready.map((r) => ({ id: r.id, industry: r.industry, funding_stage: r.funding_stage, country: country.get(r.founder_contact_id) ?? null })),
    cfg.cohort_cap,
  );
  const counts = new Map<string, number>();
  for (const part of chunk(ready.map((r) => r.id), 200)) {
    const { data } = await db.from("match_campaign_founders").select("id, match_count").in("id", part);
    for (const r of (data ?? []) as Array<{ id: string; match_count: number }>) counts.set(r.id, r.match_count);
  }
  const by = new Map<string, CohortSummaryRow & { total: number }>();
  for (const r of ready) {
    const key = keys.get(r.id) ?? "Unknown";
    const row = by.get(key) ?? { key, founders: 0, avgMatches: 0, sequence: 0, single: 0, excluded: cfg.excluded_cohorts.includes(key), total: 0 };
    row.founders++;
    row.total += counts.get(r.id) ?? 0;
    if (variantFor(r.id, cfg.holdout_pct) === "single") row.single++;
    else row.sequence++;
    by.set(key, row);
  }
  const cohorts = [...by.values()]
    .map(({ total, ...c }) => ({ ...c, avgMatches: c.founders ? Math.round(total / c.founders) : 0 }))
    .sort((a, b) => b.founders - a.founders || a.key.localeCompare(b.key));
  return { cohorts, cap: cfg.cohort_cap, holdoutPct: cfg.holdout_pct };
}

/**
 * Before Day 0 sends: writes cohort_key and variant on every unsent ready
 * founder, and skips founders in cohorts the admin left out. Idempotent.
 */
export async function assignCohorts(campaign: MatchCampaignRow): Promise<void> {
  const db = marketingDb();
  const cfg = campaign.match_config;
  const ready = await readyFounders(campaign.id);
  if (!ready.length) return;
  const country = await countries(ready.map((r) => r.founder_contact_id));
  const keys = cohortKeys(
    ready.map((r) => ({ id: r.id, industry: r.industry, funding_stage: r.funding_stage, country: country.get(r.founder_contact_id) ?? null })),
    cfg.cohort_cap,
  );
  const now = new Date().toISOString();
  for (const r of ready) {
    const key = keys.get(r.id) ?? "Unknown";
    if (cfg.excluded_cohorts.includes(key)) {
      await db
        .from("match_campaign_founders")
        .update({ cohort_key: key, send_status: "skipped", send_error: "Cohort left out of this campaign", updated_at: now })
        .eq("id", r.id);
      continue;
    }
    const variant = variantFor(r.id, cfg.holdout_pct);
    if (r.cohort_key === key && r.variant === variant) continue;
    await db.from("match_campaign_founders").update({ cohort_key: key, variant, updated_at: now }).eq("id", r.id);
  }
}

/** Columns written with the Day 0 send so the founder enters (or skips) the sequence. */
export function enrollmentPatch(row: { variant: string | null; match_count: number }, sentAt: string, messageId: string | null): Record<string, unknown> {
  const base = { thread_message_id: messageId, day0_match_count: row.match_count };
  if (row.variant !== "sequence") return base;
  return {
    ...base,
    followup_status: "active",
    followup_branch: "a",
    followup_step: 0,
    next_followup_at: new Date(new Date(sentAt).getTime() + 3 * DAY).toISOString(),
  };
}

// ── Runner ──────────────────────────────────────────────────────────────────

type DueRow = {
  id: string;
  campaign_id: string;
  founder_contact_id: string;
  email: string | null;
  company: string | null;
  match_count: number;
  day0_match_count: number | null;
  thread_message_id: string | null;
  sent_at: string | null;
  opened_page_at: string | null;
  clicked_intro_at: string | null;
  booked_at: string | null;
  plan_started_at: string | null;
  replied_at: string | null;
  followup_branch: FollowupBranch | null;
  followup_step: number;
};

const DUE_SELECT =
  "id, campaign_id, founder_contact_id, email, company, match_count, day0_match_count, thread_message_id, sent_at, opened_page_at, clicked_intro_at, booked_at, plan_started_at, replied_at, followup_branch, followup_step";

/** Booked a call or started a paid plan after the Day 0 email. Writes what it finds. */
async function refreshSignals(f: DueRow): Promise<DueRow> {
  const db = marketingDb();
  if (!f.sent_at) return f;
  const patch: Record<string, string> = {};
  if (!f.booked_at) {
    const { data: byContact } = await db.from("scheduling_bookings").select("created_at").eq("contact_crm_id", f.founder_contact_id).gte("created_at", f.sent_at).limit(1);
    let hit = ((byContact ?? []) as Array<{ created_at: string }>)[0]?.created_at ?? null;
    if (!hit && f.email) {
      const { data: byMail } = await db.from("scheduling_bookings").select("created_at").ilike("booker_email", f.email.trim()).gte("created_at", f.sent_at).limit(1);
      hit = ((byMail ?? []) as Array<{ created_at: string }>)[0]?.created_at ?? null;
    }
    if (hit) patch.booked_at = hit;
  }
  if (!f.plan_started_at && f.email) {
    const { data: prof } = await db.from("profiles").select("id").ilike("email", f.email.trim()).limit(1);
    const pid = ((prof ?? []) as Array<{ id: string }>)[0]?.id;
    if (pid) {
      const { data: sub } = await db.from("subscriptions").select("created_at").eq("profile_id", pid).in("plan_type", PAID_PLANS).gte("created_at", f.sent_at).limit(1);
      const started = ((sub ?? []) as Array<{ created_at: string }>)[0]?.created_at;
      if (started) patch.plan_started_at = started;
    }
  }
  if (Object.keys(patch).length) {
    await db.from("match_campaign_founders").update(patch).eq("id", f.id);
    return { ...f, ...patch };
  }
  return f;
}

async function closeCallTasks(campaignFounderId: string): Promise<void> {
  const db = marketingDb();
  const now = new Date().toISOString();
  await db
    .from("sales_tasks")
    .update({ status: "done", done_at: now, updated_at: now })
    .eq("source_kind", "match_campaign")
    .eq("source_ref", campaignFounderId)
    .eq("status", "open");
}

type TopInvestor = { name: string; focus: string | null; views: number };

/** Most viewed investor on the match page, else the top match by score. */
async function topInvestor(campaignFounderId: string): Promise<TopInvestor | null> {
  const db = marketingDb();
  const { data: matches } = await db
    .from("match_campaign_matches")
    .select("id, investor_contact_id, sectors, stages, match_score")
    .eq("campaign_founder_id", campaignFounderId)
    .eq("removed", false)
    .order("match_score", { ascending: false });
  const rows = (matches ?? []) as Array<{ id: string; investor_contact_id: string; sectors: string[] | null; stages: string[] | null; match_score: number }>;
  if (!rows.length) return null;
  const { data: views } = await db.from("match_campaign_investor_views").select("match_id, view_count").eq("campaign_founder_id", campaignFounderId);
  const viewOf = new Map(((views ?? []) as Array<{ match_id: string; view_count: number }>).map((v) => [v.match_id, v.view_count]));
  const best = [...rows].sort((a, b) => (viewOf.get(b.id) ?? 0) - (viewOf.get(a.id) ?? 0) || b.match_score - a.match_score)[0];
  const names = await investorNames(db, [best.investor_contact_id]);
  const n = names.get(best.investor_contact_id);
  const name = n?.investor_name || n?.investor_firm;
  if (!name) return null;
  const sectors = (best.sectors ?? []).slice(0, 2).join(" and ");
  const stages = (best.stages ?? []).map(stageLabel).slice(0, 2).join(" and ");
  const focus = sectors && stages ? `${sectors} at ${stages}` : sectors || stages || null;
  return { name, focus, views: viewOf.get(best.id) ?? 0 };
}

async function callOwner(f: DueRow, campaignCreator: string | null): Promise<{ assignee: string | null; opportunity: string | null }> {
  const db = marketingDb();
  const { data } = await db
    .from("sales_opportunities")
    .select("id, owner_id")
    .eq("contact_crm_id", f.founder_contact_id)
    .order("updated_at", { ascending: false })
    .limit(1);
  const opp = ((data ?? []) as Array<{ id: string; owner_id: string | null }>)[0];
  return { assignee: opp?.owner_id ?? campaignCreator, opportunity: opp?.id ?? null };
}

type CampaignCtx = { campaign: MatchCampaignRow; createdBy: string | null; emailRoom: number };

async function campaignCtx(campaignId: string): Promise<CampaignCtx | null> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) return null;
  const { data } = await db.from("marketing_campaigns").select("created_by").eq("id", campaignId).maybeSingle();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data: founderIds } = await db.from("match_campaign_founders").select("id").eq("campaign_id", campaignId).not("followup_status", "is", null);
  let sentToday = 0;
  for (const part of chunk(((founderIds ?? []) as Array<{ id: string }>).map((r) => r.id), 200)) {
    const { count } = await db
      .from("match_campaign_followups")
      .select("id", { count: "exact", head: true })
      .in("campaign_founder_id", part)
      .eq("channel", "email")
      .gte("created_at", dayStart.toISOString());
    sentToday += count ?? 0;
  }
  return {
    campaign,
    createdBy: ((data as { created_by?: string | null } | null)?.created_by as string | null) ?? null,
    emailRoom: Math.max(0, campaign.match_config.daily_cap - sentToday),
  };
}

export type RunResult = { checked: number; emails: number; calls: number; recorded: number; stopped: number; completed: number; failed: number };

/** One cron pass: every founder whose next follow up is due. */
export async function processMatchFollowups(now: Date = new Date()): Promise<RunResult> {
  const db = marketingDb();
  const out: RunResult = { checked: 0, emails: 0, calls: 0, recorded: 0, stopped: 0, completed: 0, failed: 0 };
  const { data, error } = await db
    .from("match_campaign_founders")
    .select(DUE_SELECT)
    .eq("followup_status", "active")
    .lte("next_followup_at", now.toISOString())
    .order("next_followup_at", { ascending: true })
    .limit(RUN_LIMIT);
  if (error) throw new Error(error.message);
  const due = (data ?? []) as DueRow[];
  const ctxs = new Map<string, CampaignCtx | null>();

  for (const raw of due) {
    if (!ctxs.has(raw.campaign_id)) ctxs.set(raw.campaign_id, await campaignCtx(raw.campaign_id));
    const ctx = ctxs.get(raw.campaign_id);
    // Sequence turned off for this campaign (or the flag): leave the row as is.
    if (!ctx || !sequenceActive(ctx.campaign.match_config)) continue;
    out.checked++;
    const f = await refreshSignals(raw);
    const state: FollowupState = {
      sent_at: f.sent_at,
      opened_page_at: f.opened_page_at,
      clicked_intro_at: f.clicked_intro_at,
      booked_at: f.booked_at,
      plan_started_at: f.plan_started_at,
      replied_at: f.replied_at,
      unsubscribed: f.email ? await isUnsubscribed(f.email) : true,
      followup_branch: f.followup_branch,
      followup_step: f.followup_step,
    };
    const d = decideFollowup(state, now);
    const ts = now.toISOString();

    if (d.action === "stop") {
      await stopFounder(f.id, d.reason);
      out.stopped++;
      continue;
    }
    if (d.action === "complete") {
      await db.from("match_campaign_founders").update({ followup_status: "completed", followup_branch: d.branch, next_followup_at: null, updated_at: ts }).eq("id", f.id);
      out.completed++;
      continue;
    }
    if (d.action === "wait") {
      await db
        .from("match_campaign_founders")
        .update({ followup_branch: d.branch, followup_step: d.stepIndex, next_followup_at: d.at, updated_at: ts })
        .eq("id", f.id);
      continue;
    }

    // send
    const cfg = ctx.campaign.match_config;
    const testOnly = cfg.dry_run || (f.email ? isInternalAccount({ email: f.email, role: "founder" }) : true);
    if (d.step.channel === "email" && !testOnly && ctx.emailRoom <= 0) continue; // today's cap is used; next pass
    const { data: done } = await db.from("match_campaign_followups").select("id").eq("campaign_founder_id", f.id).eq("step_key", d.step.key).maybeSingle();
    let status: "sent" | "dry_run" | "failed" | "skipped" = "skipped";
    let resendId: string | null = null;
    let taskId: string | null = null;
    let err: string | null = null;

    if (!done) {
      const token = makeFounderToken(f.id);
      const company = f.company?.trim() || "your company";
      if (d.step.channel === "email") {
        const html = renderFollowupEmail(d.step.key, {
          company,
          matchCount: f.match_count,
          day0MatchCount: f.day0_match_count,
          topInvestor: d.step.key === "b1" ? await topInvestor(f.id) : null,
          links: { matches: `${appUrl()}/matches/${token}`, intro: `${appUrl()}/mc/${token}?a=intro` },
          postalAddress: postalAddress(),
        });
        const subject = followupSubject(
          renderSubject(ctx.campaign.subject_override || DEFAULT_SUBJECT, { matchCount: f.day0_match_count ?? f.match_count, company }),
        );
        if (!html) status = "skipped";
        else if (testOnly) status = "dry_run";
        else if (!emailConfigured()) {
          status = "failed";
          err = "RESEND_API_KEY not configured";
        } else {
          const headers: Record<string, string> = f.thread_message_id ? { "In-Reply-To": f.thread_message_id, References: f.thread_message_id } : {};
          const r = await sendMarketingEmail({
            to: f.email as string,
            first_name: null,
            company: f.company,
            from_name: ctx.campaign.from_name,
            from_email: ctx.campaign.from_email,
            reply_to: ctx.campaign.reply_to,
            subject,
            html_body: html,
            text_body: null,
            unsubscribe_token: makeUnsubscribeToken(f.email as string),
            headers,
          });
          status = r.ok ? "sent" : "failed";
          resendId = r.resend_id;
          err = r.error ?? null;
          ctx.emailRoom--;
        }
      } else {
        // Call step: a Sales Hub task for the founder's owner. Test mode records only.
        if (cfg.dry_run) status = "dry_run";
        else {
          const top = await topInvestor(f.id);
          const text = callTaskText({ company, matchCount: f.match_count, topInvestor: top?.name ?? null });
          const owner = await callOwner(f, ctx.createdBy);
          const { data: task, error: te } = await db
            .from("sales_tasks")
            .insert({
              title: text.title,
              task_type: "Call",
              summary: text.summary,
              due_date: ts.slice(0, 10),
              status: "open",
              assignee_id: owner.assignee,
              opportunity_id: owner.opportunity,
              contact_crm_id: f.founder_contact_id,
              contact_name: f.company,
              created_by: ctx.createdBy,
              source_kind: "match_campaign",
              source_ref: f.id,
            })
            .select("id")
            .single();
          status = te ? "failed" : "sent";
          taskId = (task as { id: string } | null)?.id ?? null;
          err = te?.message ?? null;
        }
      }
      await db.from("match_campaign_followups").insert({
        campaign_founder_id: f.id,
        step_key: d.step.key,
        channel: d.step.channel,
        status,
        resend_id: resendId,
        sales_task_id: taskId,
        error: err,
      });
      if (status === "sent" && d.step.channel === "email") out.emails++;
      else if (status === "sent") out.calls++;
      else if (status === "dry_run") out.recorded++;
      else if (status === "failed") out.failed++;
    }

    // Advance, then schedule the next step from the same rules.
    const nextState: FollowupState = { ...state, followup_branch: d.branch, followup_step: d.stepIndex + 1 };
    const next = decideFollowup(nextState, now);
    const nextAt = next.action === "wait" ? next.at : next.action === "send" ? ts : null;
    await db
      .from("match_campaign_founders")
      .update({
        followup_branch: d.branch,
        followup_step: d.stepIndex + 1,
        next_followup_at: nextAt,
        ...(nextAt ? {} : { followup_status: "completed" }),
        updated_at: ts,
      })
      .eq("id", f.id);
  }
  return out;
}

async function stopFounder(id: string, reason: StopReason): Promise<void> {
  const db = marketingDb();
  await db
    .from("match_campaign_founders")
    .update({ followup_status: "stopped", followup_stop_reason: reason, next_followup_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("followup_status", "active");
  await closeCallTasks(id);
}

// ── Page views and replies ──────────────────────────────────────────────────

/** Counts one open of an investor profile on the founder's match page. */
export async function recordInvestorView(campaignFounderId: string, matchId: string): Promise<boolean> {
  const db = marketingDb();
  const { data: m } = await db.from("match_campaign_matches").select("id").eq("id", matchId).eq("campaign_founder_id", campaignFounderId).eq("removed", false).maybeSingle();
  if (!m) return false;
  const now = new Date().toISOString();
  const { data: v } = await db.from("match_campaign_investor_views").select("id, view_count").eq("campaign_founder_id", campaignFounderId).eq("match_id", matchId).maybeSingle();
  if (v) {
    const row = v as { id: string; view_count: number };
    await db.from("match_campaign_investor_views").update({ view_count: row.view_count + 1, last_viewed_at: now }).eq("id", row.id);
  } else {
    await db.from("match_campaign_investor_views").insert({ campaign_founder_id: campaignFounderId, match_id: matchId });
  }
  return true;
}

/** Admin marks a founder as replied: stops their follow ups. Unmarking does not restart them. */
export async function markReplied(campaignFounderId: string, replied: boolean): Promise<void> {
  const db = marketingDb();
  await db
    .from("match_campaign_founders")
    .update({ replied_at: replied ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", campaignFounderId);
  if (replied) await stopFounder(campaignFounderId, "replied");
}

// ── Results ─────────────────────────────────────────────────────────────────

export type VariantRow = { sent: number; pageOpened: number; booked: number; introRequested: number; plans: number };
export type CohortResultRow = VariantRow & { key: string; variant: "single" | "sequence" };

export type SequenceResults = {
  enabled: boolean;
  enoughData: boolean;
  minPerVariant: number;
  single: VariantRow;
  sequence: VariantRow;
  byCohort: CohortResultRow[];
  followups: { emails: number; calls: number; recorded: number; failed: number };
  stopped: Array<{ reason: StopReason; count: number }>;
  active: number;
  founders: Array<{ id: string; company: string | null; cohort: string | null; branch: FollowupBranch | null; status: string | null; replied: boolean }>;
};

const MIN_PER_VARIANT = 50;

export async function loadSequenceResults(campaignId: string): Promise<SequenceResults> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  type Row = {
    id: string;
    company: string | null;
    cohort_key: string | null;
    variant: "single" | "sequence" | null;
    opened_page_at: string | null;
    booked_at: string | null;
    clicked_intro_at: string | null;
    plan_started_at: string | null;
    replied_at: string | null;
    followup_branch: FollowupBranch | null;
    followup_status: string | null;
    followup_stop_reason: StopReason | null;
  };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("match_campaign_founders")
      .select("id, company, cohort_key, variant, opened_page_at, booked_at, clicked_intro_at, plan_started_at, replied_at, followup_branch, followup_status, followup_stop_reason")
      .eq("campaign_id", campaignId)
      .in("send_status", ["sent", "dry_run"])
      .not("variant", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    rows.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < 1000) break;
  }
  const empty = (): VariantRow => ({ sent: 0, pageOpened: 0, booked: 0, introRequested: 0, plans: 0 });
  const add = (v: VariantRow, r: Row) => {
    v.sent++;
    if (r.opened_page_at) v.pageOpened++;
    if (r.booked_at) v.booked++;
    if (r.clicked_intro_at) v.introRequested++;
    if (r.plan_started_at) v.plans++;
  };
  const single = empty();
  const sequence = empty();
  const cohorts = new Map<string, CohortResultRow>();
  const stops = new Map<StopReason, number>();
  let active = 0;
  for (const r of rows) {
    const variant = r.variant === "single" ? "single" : "sequence";
    add(variant === "single" ? single : sequence, r);
    const k = `${r.cohort_key ?? "Unknown"}|${variant}`;
    const c = cohorts.get(k) ?? { key: r.cohort_key ?? "Unknown", variant, ...empty() };
    add(c, r);
    cohorts.set(k, c);
    if (r.followup_status === "active") active++;
    if (r.followup_stop_reason) stops.set(r.followup_stop_reason, (stops.get(r.followup_stop_reason) ?? 0) + 1);
  }
  const followups = { emails: 0, calls: 0, recorded: 0, failed: 0 };
  for (const part of chunk(rows.map((r) => r.id), 200)) {
    const { data } = await db.from("match_campaign_followups").select("channel, status").in("campaign_founder_id", part);
    for (const x of (data ?? []) as Array<{ channel: string; status: string }>) {
      if (x.status === "sent" && x.channel === "email") followups.emails++;
      else if (x.status === "sent") followups.calls++;
      else if (x.status === "dry_run") followups.recorded++;
      else if (x.status === "failed") followups.failed++;
    }
  }
  return {
    enabled: sequenceActive(campaign.match_config),
    enoughData: single.sent >= MIN_PER_VARIANT && sequence.sent >= MIN_PER_VARIANT,
    minPerVariant: MIN_PER_VARIANT,
    single,
    sequence,
    byCohort: [...cohorts.values()].sort((a, b) => a.key.localeCompare(b.key) || a.variant.localeCompare(b.variant)),
    followups,
    stopped: [...stops.entries()].map(([reason, count]) => ({ reason, count })),
    active,
    founders: rows
      .filter((r) => r.variant === "sequence")
      .map((r) => ({ id: r.id, company: r.company, cohort: r.cohort_key, branch: r.followup_branch, status: r.followup_status, replied: Boolean(r.replied_at) })),
  };
}
