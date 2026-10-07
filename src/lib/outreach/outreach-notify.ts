/**
 * Queued and sent notifications for automated investor outreach.
 *
 * Every time the outreach engine queues introductions for a founder (campaign
 * created) or sends a batch (the weekly pass), this records it in four places
 * at the same moment, so the history always matches what the founder was told:
 *
 *   1. Founder email: one digest per pass, investor names only, never a match
 *      score. Goes through sendEmail, so the founder email budget applies.
 *   2. Founder in-app notification: the founder's own record of the event.
 *   3. Admin account activity: one event per founder per pass via
 *      recordActivity, which also notifies staff in-app (classes
 *      outreach_queued / outreach_sent, in-app only by default).
 *   4. Investor contact timeline: one sales_activity_log row per investor on
 *      their CRM contact, with the match score (internal view).
 *
 * Never throws. A notification or log failure must never stop a send or a
 * queue; the outreach itself is the product.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { shouldSendEmail } from "@/lib/notifications/preferences";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail, type EmailBlock } from "@/lib/email/layout";
import { recordActivity } from "@/lib/activity/emit";
import { INTRO_TEMPLATE_KEY } from "@/lib/outreach/intro-template";
import { formatRunDay, formatRunTime, nextOutreachRun } from "@/lib/outreach/outreach-schedule";
import { resolveFounderOutreachConfig } from "@/lib/outreach/founder-overrides";
import type { NextBatch } from "@/lib/outreach/outreach-next-batch";
import { getOutreachAutomationEnabled } from "@/lib/settings/platform-settings";

export type OutreachInvestor = { investorRef: string; name: string; matchScore: number };

/** How many names the founder email lists before "and N more". */
const LIST_LIMIT = 5;

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function planLabel(plan: string | null): string | null {
  if (!plan) return null;
  return plan.charAt(0).toUpperCase() + plan.slice(1).replace(/_/g, " ");
}

/** "A, B, C and 30 more" (names only, for founder facing copy). */
export function namesSummary(names: string[], limit = 3): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= limit) {
    if (clean.length <= 1) return clean.join("");
    return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
  }
  return `${clean.slice(0, limit).join(", ")} and ${clean.length - limit} more`;
}

type Context = {
  companyName: string;
  founderId: string | null;
  founderEmail: string | null;
  founderFirstName: string | null;
  slug: string | null;
  isPublished: boolean;
};

async function loadContext(companyId: string): Promise<Context | null> {
  try {
    const client = db();
    const { data: comp } = await client
      .from("companies")
      .select("company_name, founder_id, slug, is_published")
      .eq("id", companyId)
      .maybeSingle();
    if (!comp) return null;
    const c = comp as { company_name: string | null; founder_id: string | null; slug: string | null; is_published: boolean | null };
    let founderEmail: string | null = null;
    let founderFirstName: string | null = null;
    if (c.founder_id) {
      const { data: prof } = await client.from("profiles").select("email, full_name").eq("id", c.founder_id).maybeSingle();
      const p = prof as { email: string | null; full_name: string | null } | null;
      founderEmail = p?.email?.trim() || null;
      founderFirstName = (p?.full_name ?? "").trim().split(/\s+/)[0] || null;
    }
    return {
      companyName: c.company_name?.trim() || "your company",
      founderId: c.founder_id,
      founderEmail,
      founderFirstName,
      slug: c.slug,
      isPublished: Boolean(c.is_published && c.slug),
    };
  } catch {
    return null;
  }
}

/** Investor names as email rows (no scores). */
function nameRows(investors: OutreachInvestor[], right?: string): EmailBlock[] {
  const shown = investors.slice(0, LIST_LIMIT);
  const extra = investors.length - shown.length;
  const items: Array<{ title: string; right: string | null }> = shown.map((i) => ({ title: i.name, right: right ?? null }));
  if (extra > 0) items.push({ title: `and ${extra} more`, right: null });
  return [{ type: "rows", items }];
}

async function emailFounder(ctx: Context, kind: string, mail: { subject: string; html: string; text: string }) {
  if (!ctx.founderId || !ctx.founderEmail) return;
  try {
    if (!(await shouldSendEmail(ctx.founderId, kind))) return;
    await sendEmail({
      to: ctx.founderEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      source: kind,
      audience: "founder",
    });
  } catch {
    /* never block outreach */
  }
}

async function logInvestorTimeline(
  investors: OutreachInvestor[],
  kind: "outreach_queued" | "outreach_sent",
  summaryOf: (i: OutreachInvestor) => string,
  meta: Record<string, unknown>,
) {
  if (investors.length === 0) return;
  try {
    const rows = investors.map((i) => ({
      contact_crm_id: i.investorRef,
      actor_id: null,
      kind,
      summary: summaryOf(i).slice(0, 2000),
      meta: { ...meta, match_score: i.matchScore },
    }));
    await db().from("sales_activity_log").insert(rows);
  } catch {
    /* logging must never break the send */
  }
}

/** Founder email: introductions queued. Exported for tests. */
export function renderQueuedEmail(input: {
  companyName: string;
  firstName: string | null;
  investors: OutreachInvestor[];
  planName: string | null;
  monthlyCap: number | null;
  isPublished: boolean;
  /** When the first batch goes out; omitted when unknown. */
  firstRunAt?: Date | null;
}): { subject: string; html: string; text: string } {
  const n = input.investors.length;
  const base = appBase();
  const capLine =
    (input.monthlyCap && input.monthlyCap > 0
      ? `They go out in batches, within your ${input.planName ? `${input.planName} plan ` : ""}limit of ${input.monthlyCap} introductions a month.`
      : "They go out in batches over the coming weeks.") +
    (input.firstRunAt ? ` The first batch goes out ${formatRunTime(input.firstRunAt)}, and we'll remind you the day before each batch after that.` : "");
  const subject = `${n} investor ${plural(n, "introduction is", "introductions are")} queued for ${input.companyName}`;
  return renderEmail({
    audience: "founder",
    subject,
    preheader: `Your Founder Preview is lined up for ${n} ${plural(n, "investor", "investors")}.`,
    context: input.companyName,
    headline: subject,
    intro: `${input.firstName ? `Hi ${input.firstName}, y` : "Y"}our Founder Preview is lined up for ${n} ${plural(n, "investor", "investors")} whose stated focus matches ${input.companyName}. ${capLine}`,
    blocks: [
      { type: "paragraph", text: "Queued investors" },
      ...nameRows(input.investors),
      input.isPublished
        ? { type: "note", text: "Make sure your one-pager is current before it sends. Investors see whatever is published at the time of sending." }
        : { type: "note", tone: "warning", text: "Your one-pager isn't published yet. Introductions wait until it is, so publish it to start sending." },
    ],
    primary: { label: "Review your one-pager", url: `${base}/founder/preview` },
    secondary: { label: "View all queued introductions", url: `${base}/founder/deploy` },
    footer: {
      reason: "You're receiving this because automated investor outreach is active for your company.",
      preferencesUrl: `${base}/founder/settings/email`,
      lines: ["Introductions are generated from platform fit scoring and are not investment advice or a solicitation."],
    },
  });
}

/** Founder email: introductions sent. Exported for tests. */
export function renderSentEmail(input: {
  companyName: string;
  firstName: string | null;
  investors: OutreachInvestor[];
  sentThisMonth: number;
  monthlyCap: number | null;
  stillQueued: number;
  /** When the next batch goes out, if more are queued. */
  nextRunAt?: Date | null;
}): { subject: string; html: string; text: string } {
  const n = input.investors.length;
  const base = appBase();
  const subject = `Your Founder Preview went to ${n} ${plural(n, "investor", "investors")} today`;
  return renderEmail({
    audience: "founder",
    subject,
    preheader: `We sent ${input.companyName}'s Founder Preview to ${namesSummary(input.investors.map((i) => i.name))}.`,
    context: input.companyName,
    headline: subject,
    intro: `${input.firstName ? `Hi ${input.firstName}, w` : "W"}e sent ${input.companyName}'s Founder Preview to ${plural(n, "this investor", "these investors")} today.`,
    blocks: [
      ...nameRows(input.investors, "Sent"),
      {
        type: "stats",
        items: [
          { value: input.monthlyCap ? `${input.sentThisMonth} of ${input.monthlyCap}` : String(input.sentThisMonth), label: "Sent this month" },
          { value: String(input.stillQueued), label: "Still queued" },
        ],
      },
      ...(input.nextRunAt && input.stillQueued > 0
        ? [{ type: "note" as const, text: `Next batch: ${formatRunTime(input.nextRunAt)}. We'll remind you the day before.` }]
        : []),
      { type: "paragraph", text: "When an investor replies with interest, we'll make the introduction by email and let you know right away. No action is needed from you until then." },
    ],
    primary: { label: "Track your outreach", url: `${base}/founder/deploy` },
    footer: {
      reason: "You're receiving this because automated investor outreach is active for your company.",
      preferencesUrl: `${base}/founder/settings/email`,
      lines: ["Introductions are generated from platform fit scoring and are not investment advice or a solicitation."],
    },
  });
}

/**
 * When a campaign's first batch will go out, for the queued email. Null when
 * sending is off (nothing reaches investors) or it can't be worked out.
 */
async function firstRunFor(campaignId: string, founderId: string | null): Promise<Date | null> {
  try {
    if (!(await getOutreachAutomationEnabled())) return null;
    const { data } = await db().from("investor_outreach_campaigns").select("company_id, last_run_at").eq("id", campaignId).maybeSingle();
    const row = data as { company_id: string; last_run_at: string | null } | null;
    if (!row) return null;
    let startDate: string | null = null;
    let pauseUntil: string | null = null;
    if (founderId) {
      const eff = await resolveFounderOutreachConfig({ id: row.company_id, founder_id: founderId });
      if (eff.pause.enabled && !eff.pause.until) return null;
      startDate = eff.startDate;
      pauseUntil = eff.pause.enabled ? eff.pause.until : null;
    }
    return nextOutreachRun({ lastRunAt: row.last_run_at, startDate, pauseUntil });
  } catch {
    return null;
  }
}

/**
 * Introductions were queued for a founder (campaign created). Call once per
 * campaign creation with every recipient just queued.
 */
export async function notifyOutreachQueued(input: {
  companyId: string;
  campaignId: string;
  investors: OutreachInvestor[];
  planType: string | null;
  monthlyCap: number | null;
  /**
   * When the first batch goes out. Leave undefined to work it out from the
   * campaign; pass null when the batch is sending right now (refill mid-run).
   */
  firstRunAt?: Date | null;
}): Promise<void> {
  try {
    const investors = [...input.investors].sort((a, b) => b.matchScore - a.matchScore);
    const n = investors.length;
    if (n === 0) return;
    const ctx = await loadContext(input.companyId);
    if (!ctx) return;
    const firstRunAt = input.firstRunAt === undefined ? await firstRunFor(input.campaignId, ctx.founderId) : input.firstRunAt;
    const plan = planLabel(input.planType);
    const names = investors.map((i) => i.name);

    // 1. Founder email (names only).
    await emailFounder(
      ctx,
      "outreach_intros_queued",
      renderQueuedEmail({
        companyName: ctx.companyName,
        firstName: ctx.founderFirstName,
        investors,
        planName: plan,
        monthlyCap: input.monthlyCap,
        isPublished: ctx.isPublished,
        firstRunAt,
      }),
    );

    // 2. Founder in-app record (names only).
    if (ctx.founderId) {
      await createNotification({
        recipientUserId: ctx.founderId,
        type: "outreach_intros_queued",
        title: `${n} ${plural(n, "introduction", "introductions")} queued`,
        message: namesSummary(names),
        entityType: "investor_outreach_campaign",
        entityId: input.campaignId,
        severity: "info",
        deepLink: "/founder/deploy",
      });
    }

    // 3. Admin account activity (+ staff in-app alert), with scores.
    await recordActivity({
      classKey: "outreach_queued",
      actorUserId: null,
      actorRole: "system",
      companyId: input.companyId,
      entityType: "investor_outreach_campaign",
      entityId: input.campaignId,
      title: `${ctx.companyName}: ${n} ${plural(n, "introduction", "introductions")} queued`,
      description: investors.map((i) => `${i.name} (${i.matchScore}%)`).join(", ").slice(0, 1000),
      sourceModule: "investor_outreach",
      metadata: {
        count: n,
        plan: input.planType,
        monthly_cap: input.monthlyCap,
        investors: investors.map((i) => ({ ref: i.investorRef, name: i.name, score: i.matchScore })),
      },
    });

    // 4. Investor contact timelines, with scores.
    await logInvestorTimeline(
      investors,
      "outreach_queued",
      (i) => `Queued for Founder Preview: ${ctx.companyName} (match ${i.matchScore}%)`,
      { source: "automated_outreach", company_id: input.companyId, campaign_id: input.campaignId, template: INTRO_TEMPLATE_KEY },
    );
  } catch (error) {
    console.error("[capitalos] outreach queued notify failed", error instanceof Error ? error.message : error);
  }
}

/**
 * A weekly pass sent a batch for one founder. `emailed` is false when the pass
 * only advanced the log (automation off, or a demo/internal account): then
 * nothing reached investors, so the founder is not told it did. Admin activity
 * and investor timelines still record it, marked as logged only.
 */
export async function notifyOutreachSent(input: {
  companyId: string;
  campaignId: string;
  investors: OutreachInvestor[];
  emailed: boolean;
  sentThisMonth: number;
  monthlyCap: number | null;
  stillQueued: number;
  planType: string | null;
}): Promise<void> {
  try {
    const investors = [...input.investors].sort((a, b) => b.matchScore - a.matchScore);
    const n = investors.length;
    if (n === 0) return;
    const ctx = await loadContext(input.companyId);
    if (!ctx) return;
    const names = investors.map((i) => i.name);
    const capReached = Boolean(input.monthlyCap && input.sentThisMonth >= input.monthlyCap);

    if (input.emailed) {
      // 1. Founder email (names only).
      await emailFounder(
        ctx,
        "outreach_intros_sent",
        renderSentEmail({
          companyName: ctx.companyName,
          firstName: ctx.founderFirstName,
          investors,
          sentThisMonth: input.sentThisMonth,
          monthlyCap: input.monthlyCap,
          stillQueued: input.stillQueued,
          nextRunAt: nextOutreachRun({ lastRunAt: new Date().toISOString() }),
        }),
      );

      // 2. Founder in-app record (names only).
      if (ctx.founderId) {
        await createNotification({
          recipientUserId: ctx.founderId,
          type: "outreach_intros_sent",
          title: `Founder Preview sent to ${n} ${plural(n, "investor", "investors")}`,
          message: namesSummary(names),
          entityType: "investor_outreach_campaign",
          entityId: input.campaignId,
          severity: "info",
          deepLink: "/founder/deploy",
        });
      }
    }

    // 3. Admin account activity (+ staff in-app alert), with scores.
    const plan = planLabel(input.planType);
    await recordActivity({
      classKey: "outreach_sent",
      actorUserId: null,
      actorRole: "system",
      companyId: input.companyId,
      entityType: "investor_outreach_campaign",
      entityId: input.campaignId,
      title: `${ctx.companyName}: ${n} sent${input.emailed ? "" : " (logged only, not emailed)"}${capReached ? " · cap reached" : ""}`,
      description: [
        investors.map((i) => `${i.name} (${i.matchScore}%)`).join(", "),
        `${plan ? `${plan} · ` : ""}${input.sentThisMonth}${input.monthlyCap ? ` of ${input.monthlyCap}` : ""} this month · ${input.stillQueued} still queued`,
      ].join(". ").slice(0, 1000),
      sourceModule: "investor_outreach",
      metadata: {
        count: n,
        emailed: input.emailed,
        plan: input.planType,
        monthly_cap: input.monthlyCap,
        sent_this_month: input.sentThisMonth,
        still_queued: input.stillQueued,
        cap_reached: capReached,
        investors: investors.map((i) => ({ ref: i.investorRef, name: i.name, score: i.matchScore })),
      },
    });

    // 4. Investor contact timelines, with scores.
    await logInvestorTimeline(
      investors,
      "outreach_sent",
      (i) => `Founder Preview ${input.emailed ? "sent" : "logged as sent (not emailed)"}: ${ctx.companyName} (match ${i.matchScore}%)`,
      { source: "automated_outreach", company_id: input.companyId, campaign_id: input.campaignId, template: INTRO_TEMPLATE_KEY, emailed: input.emailed },
    );
  } catch (error) {
    console.error("[capitalos] outreach sent notify failed", error instanceof Error ? error.message : error);
  }
}

// ── Day-before reminder (automated outreach) ─────────────────────────────────

/** Founder email: the next batch goes out soon. Exported for tests. */
export function renderUpcomingEmail(input: {
  companyName: string;
  firstName: string | null;
  batch: Pick<NextBatch, "runAt" | "investors" | "upTo" | "blocked" | "periodCap" | "reachedThisPeriod" | "periodResetsAt">;
}): { subject: string; html: string; text: string } {
  const { batch } = input;
  const base = appBase();
  const when = formatRunTime(batch.runAt);
  const shown = batch.investors.slice(0, batch.upTo || batch.investors.length);
  const count = shown.length || batch.upTo;
  const subject = `Your next investor batch goes out ${formatRunDay(batch.runAt)}`;
  const who =
    shown.length > 0
      ? `${count} ${plural(count, "investor", "investors")}`
      : `up to ${batch.upTo} matched ${plural(batch.upTo, "investor", "investors")}`;
  const blocks: EmailBlock[] = [];
  if (shown.length > 0) {
    blocks.push({ type: "paragraph", text: "Going out next" }, ...nameRows(shown));
  }
  if (batch.periodCap !== null) {
    blocks.push({
      type: "stats",
      items: [
        { value: `${batch.reachedThisPeriod} of ${batch.periodCap}`, label: "Reached this period" },
        ...(batch.periodResetsAt ? [{ value: formatRunDay(batch.periodResetsAt), label: "Allowance resets" }] : []),
      ],
    });
  }
  blocks.push(
    batch.blocked === "unpublished"
      ? { type: "note", tone: "warning", text: "Your one-pager isn't published, so this batch will wait. Publish it before the run and it goes out on time." }
      : { type: "note", text: "Investors receive your one-pager as it is at the moment of sending. Now is the time for any last changes." },
  );
  return renderEmail({
    audience: "founder",
    subject,
    preheader: `Your Founder Preview goes to ${who} ${when}.`,
    context: input.companyName,
    headline: subject,
    intro: `${input.firstName ? `Hi ${input.firstName}, y` : "Y"}our Founder Preview for ${input.companyName} goes to ${who} ${when}.`,
    blocks,
    primary: { label: "Review your one-pager", url: `${base}/founder/preview` },
    secondary: { label: "View your outreach", url: `${base}/founder/deploy` },
    footer: {
      reason: "You're receiving this because automated investor outreach is active for your company.",
      preferencesUrl: `${base}/founder/settings/email`,
      lines: ["Introductions are generated from platform fit scoring and are not investment advice or a solicitation."],
    },
  });
}

/** Email and in-app notice to the founder the day before a batch. Never throws. */
export async function notifyOutreachUpcoming(batch: NextBatch): Promise<void> {
  try {
    const ctx = await loadContext(batch.companyId);
    if (!ctx?.founderId) return;
    await emailFounder(ctx, "outreach_batch_upcoming", renderUpcomingEmail({ companyName: ctx.companyName, firstName: ctx.founderFirstName, batch }));
    const names = batch.investors.slice(0, batch.upTo || batch.investors.length).map((i) => i.name);
    await createNotification({
      recipientUserId: ctx.founderId,
      type: "outreach_batch_upcoming",
      title: `Next outreach batch: ${formatRunDay(batch.runAt)}`,
      message:
        batch.blocked === "unpublished"
          ? "Waiting on your one-pager: publish it so the batch goes out on time."
          : names.length > 0
            ? namesSummary(names)
            : `Up to ${batch.upTo} matched investors`,
      entityType: "investor_outreach_campaign",
      entityId: batch.campaignId,
      severity: batch.blocked === "unpublished" ? "high" : "info",
      deepLink: "/founder/deploy",
    });
  } catch (error) {
    console.error("[capitalos] outreach upcoming notify failed", error instanceof Error ? error.message : error);
  }
}

// ── DIY (manual) outreach sends ──────────────────────────────────────────────

export type ManualSend = { name: string; stepLabel: string; stepIndex: number };

/** Founder email: DIY sequence steps that went out in this pass. Exported for tests. */
export function renderManualSentEmail(input: {
  companyName: string;
  firstName: string | null;
  sends: ManualSend[];
}): { subject: string; html: string; text: string } {
  const base = appBase();
  const n = input.sends.length;
  const subject = `Your outreach sequence sent ${n} ${plural(n, "email", "emails")} today`;
  const byStep = new Map<number, ManualSend[]>();
  for (const s of input.sends) byStep.set(s.stepIndex, [...(byStep.get(s.stepIndex) ?? []), s]);
  const blocks: EmailBlock[] = [];
  for (const [, sends] of [...byStep.entries()].sort((a, b) => a[0] - b[0])) {
    blocks.push(
      { type: "paragraph", text: sends[0].stepLabel || `Step ${sends[0].stepIndex + 1}` },
      ...nameRows(sends.map((s) => ({ investorRef: s.name, name: s.name, matchScore: 0 })), "Sent"),
    );
  }
  return renderEmail({
    audience: "founder",
    subject,
    preheader: `Sent to ${namesSummary(input.sends.map((s) => s.name))}.`,
    context: input.companyName,
    headline: subject,
    intro: `${input.firstName ? `Hi ${input.firstName}, y` : "Y"}our outreach sequence for ${input.companyName} sent these emails today. Replies come to you, and anyone who replies is taken out of the remaining steps if you turned that on.`,
    blocks,
    primary: { label: "View your outreach", url: `${base}/founder/deploy` },
    footer: {
      reason: "You're receiving this because you started an investor outreach sequence.",
      preferencesUrl: `${base}/founder/settings/email`,
      lines: ["iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser."],
    },
  });
}

/** One email and in-app notice per founder per pass, after DIY steps send. Never throws. */
export async function notifyManualOutreachSent(input: { companyId: string; sends: ManualSend[] }): Promise<void> {
  try {
    if (input.sends.length === 0) return;
    const ctx = await loadContext(input.companyId);
    if (!ctx?.founderId) return;
    await emailFounder(ctx, "manual_outreach_sent", renderManualSentEmail({ companyName: ctx.companyName, firstName: ctx.founderFirstName, sends: input.sends }));
    const n = input.sends.length;
    await createNotification({
      recipientUserId: ctx.founderId,
      type: "manual_outreach_sent",
      title: `Outreach sequence sent ${n} ${plural(n, "email", "emails")}`,
      message: namesSummary(input.sends.map((s) => s.name)),
      entityType: "company",
      entityId: input.companyId,
      severity: "info",
      deepLink: "/founder/deploy",
    });
  } catch (error) {
    console.error("[capitalos] manual outreach notify failed", error instanceof Error ? error.message : error);
  }
}
