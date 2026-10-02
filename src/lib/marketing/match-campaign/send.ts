/**
 * Sending a Match campaign: one email per ready founder with their own count
 * and top matches: investor names shown, contact details hidden. Uses the shared sender (sendMarketingEmail)
 * so the header, unsubscribe link, List-Unsubscribe headers and the outbound
 * email log are the same as every campaign. No email ever goes to investors:
 * recipients come only from match_campaign_founders. Server only.
 */
import { marketingDb } from "@/lib/marketing/db";
import { emailConfigured, makeUnsubscribeToken, sendMarketingEmail } from "@/lib/marketing/send";
import { isUnsubscribed } from "@/lib/marketing/contacts";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { priceShort } from "@/lib/subscriptions/pricing-catalog";
import { renderFounderEmail, renderReviewEmail, renderSubject, DEFAULT_SUBJECT, REVIEW_SUBJECT } from "./email";
import { investorNetworkCount, networkLabel } from "./investors";
import { makeFounderToken } from "./token";
import { getMatchCampaign, type MatchCampaignRow } from "./store";
import { sequenceActive } from "./flag";
import { assignCohorts, enrollmentPatch, threadMessageId } from "./followups";
import type { MaskedMatch } from "./types";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

export function postalAddress(): string {
  return process.env.MARKETING_POSTAL_ADDRESS?.trim() || "iCFO Capital Global, Inc., La Jolla, CA";
}

type SendContext = { network: string; basicPrice: string };

async function sendContext(): Promise<SendContext> {
  const [count, pricing] = await Promise.all([investorNetworkCount(), loadPricing()]);
  return { network: networkLabel(count), basicPrice: priceShort(pricing, "founder_basic") };
}

type FounderSendRow = {
  id: string;
  founder_contact_id: string;
  email: string | null;
  company: string | null;
  industry: string | null;
  funding_stage: string | null;
  match_count: number;
  top_matches: MaskedMatch[];
  variant?: string | null;
};

export function buildFounderMessage(campaign: MatchCampaignRow, f: FounderSendRow, ctx: SendContext): { subject: string; html: string } {
  const token = makeFounderToken(f.id);
  const company = f.company?.trim() || "your company";
  const review = campaign.match_config.flow === "review";
  const subject = renderSubject(campaign.subject_override || (review ? REVIEW_SUBJECT : DEFAULT_SUBJECT), { matchCount: f.match_count, company });
  const base = {
    company,
    industry: f.industry,
    stages: f.funding_stage ? f.funding_stage.split(", ").filter(Boolean) : [],
    matchCount: f.match_count,
    top: (f.top_matches ?? []).slice(0, campaign.match_config.preview_count),
    networkLabel: ctx.network,
    basicPrice: ctx.basicPrice,
    postalAddress: postalAddress(),
  };
  const links = {
    matches: `${appUrl()}/matches/${token}`,
    call: `${appUrl()}/mc/${token}?a=call`,
    plan: `${appUrl()}/mc/${token}?a=intro`,
    privacy: `${appUrl()}/privacy`,
  };
  const html = review
    ? renderReviewEmail({ ...base, visibleCount: campaign.match_config.visible_count, links: { ...links, profile: (n: number) => `${appUrl()}/matches/${token}/i/${n}` } })
    : renderFounderEmail({ ...base, links, layout: sequenceActive(campaign.match_config) ? "matches_first" : "classic" });
  return { subject, html };
}

/** The marketing_contacts id for a recipient (needed so opens and clicks attach to the campaign). */
async function marketingContactId(email: string, crmContactId: string, company: string | null): Promise<string | null> {
  const db = marketingDb();
  const { data: found } = await db.from("marketing_contacts").select("id").ilike("email", email).limit(1);
  const hit = (found ?? [])[0] as { id: string } | undefined;
  if (hit) return hit.id;
  const { data } = await db
    .from("marketing_contacts")
    .insert({ email: email.toLowerCase(), company, source: "match_campaign", crm_contact_id: crmContactId })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

const SELECT = "id, founder_contact_id, email, company, industry, funding_stage, match_count, top_matches";
/** With the follow up sequence on, Day 0 also reads the founder's split test variant. */
const SELECT_SEQUENCE = `${SELECT}, variant`;

/**
 * Sends up to the daily cap. Called from sendCampaign (manual send and the
 * 15 minute cron), so a scheduled Match campaign goes out like any other. When
 * founders remain after today's cap, the campaign goes back to "scheduled" and
 * the next day's cron pass continues.
 */
export async function sendMatchCampaign(campaignId: string): Promise<{ sent: number; skipped: number; failed: number }> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  const cfg = campaign.match_config;
  if (!cfg.dry_run && !emailConfigured()) {
    throw new Error("Email provider not configured. Set RESEND_API_KEY before sending.");
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await db
    .from("match_campaign_founders")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("send_status", ["sent", "dry_run", "failed"])
    .gte("sent_at", dayStart.toISOString());
  const room = Math.max(0, cfg.daily_cap - (sentToday ?? 0));
  // Today's cap is used: leave the campaign scheduled for tomorrow's cron pass.
  if (room === 0) return { sent: 0, skipped: 0, failed: 0 };

  await db.from("marketing_campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", campaignId);

  // Follow up sequence: cohorts and the holdout split are fixed before anyone is emailed.
  const withSequence = sequenceActive(cfg);
  if (withSequence) await assignCohorts(campaign);

  const { data } = await db
    .from("match_campaign_founders")
    .select(withSequence ? SELECT_SEQUENCE : SELECT)
    .eq("campaign_id", campaignId)
    .eq("send_status", "pending")
    .is("excluded_reason", null)
    .gt("match_count", 0)
    .order("created_at", { ascending: true })
    .limit(room);
  const batch = (data ?? []) as unknown as FounderSendRow[];
  const ctx = await sendContext();

  let sent = 0, skipped = 0, failed = 0;
  for (const f of batch) {
    const now = new Date().toISOString();
    if (!f.email || (await isUnsubscribed(f.email))) {
      await db.from("match_campaign_founders").update({ send_status: "skipped", excluded_reason: "suppressed", updated_at: now }).eq("id", f.id);
      skipped++;
      continue;
    }
    const { subject, html } = buildFounderMessage(campaign, f, ctx);
    // Test mode and internal (@myicfos.com) addresses: record, never dispatch.
    if (cfg.dry_run || isInternalAccount({ email: f.email, role: "founder" })) {
      await db
        .from("match_campaign_founders")
        .update({ send_status: "dry_run", sent_at: now, updated_at: now, ...(withSequence ? enrollmentPatch({ variant: f.variant ?? null, match_count: f.match_count }, now, null) : {}) })
        .eq("id", f.id);
      sent++;
      continue;
    }
    const result = await sendMarketingEmail({
      to: f.email,
      first_name: null,
      company: f.company,
      from_name: campaign.from_name,
      from_email: campaign.from_email,
      reply_to: campaign.reply_to,
      subject,
      html_body: html,
      text_body: null,
      unsubscribe_token: makeUnsubscribeToken(f.email),
      ...(withSequence ? { headers: { "Message-ID": threadMessageId(f.id, campaign.from_email) } } : {}),
    });
    const contactId = await marketingContactId(f.email, f.founder_contact_id, f.company);
    if (contactId) {
      await db.from("marketing_events").insert({
        campaign_id: campaignId,
        contact_id: contactId,
        email: f.email,
        resend_id: result.resend_id,
        event_type: result.ok ? "sent" : "failed",
        metadata: { match_campaign_founder_id: f.id, ...(result.error ? { error: result.error } : {}) },
      });
    }
    await db
      .from("match_campaign_founders")
      .update({
        send_status: result.ok ? "sent" : "failed",
        sent_at: now,
        message_id: result.resend_id,
        send_error: result.error ?? null,
        updated_at: now,
        ...(withSequence && result.ok ? enrollmentPatch({ variant: f.variant ?? null, match_count: f.match_count }, now, threadMessageId(f.id, campaign.from_email)) : {}),
      })
      .eq("id", f.id);
    if (result.ok) sent++;
    else failed++;
    await new Promise((r) => setTimeout(r, 200));
  }

  const { count: remaining } = await db
    .from("match_campaign_founders")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("send_status", "pending")
    .is("excluded_reason", null)
    .gt("match_count", 0);
  const { count: totalSent } = await db
    .from("match_campaign_founders")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("send_status", ["sent", "dry_run"]);
  const status = (remaining ?? 0) > 0 ? "scheduled" : sent === 0 && failed > 0 ? "paused" : "sent";
  await db
    .from("marketing_campaigns")
    .update({
      status,
      stat_sent: totalSent ?? 0,
      ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
      ...(status === "scheduled" && !campaign.scheduled_at ? { scheduled_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  return { sent, skipped, failed };
}

/** One real test copy to the admin, rendered for a chosen founder (or the first ready one). */
export async function sendMatchTest(
  campaignId: string,
  to: string,
  campaignFounderId?: string | null,
): Promise<{ ok: boolean; to: string; error?: string }> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) throw new Error("Match campaign not found");
  if (!emailConfigured()) return { ok: false, to, error: "Email provider not configured. Set RESEND_API_KEY." };
  let q = db.from("match_campaign_founders").select(SELECT).eq("campaign_id", campaignId).gt("match_count", 0);
  q = campaignFounderId ? q.eq("id", campaignFounderId) : q.is("excluded_reason", null);
  const { data } = await q.order("created_at", { ascending: true }).limit(1);
  const f = ((data ?? []) as FounderSendRow[])[0];
  if (!f) return { ok: false, to, error: "No founder with matches yet. Run matching first." };
  const { subject, html } = buildFounderMessage(campaign, f, await sendContext());
  const result = await sendMarketingEmail({
    to,
    first_name: null,
    company: f.company,
    from_name: campaign.from_name,
    from_email: campaign.from_email,
    reply_to: campaign.reply_to,
    subject: `[TEST] ${subject}`,
    html_body: html,
    text_body: null,
    unsubscribe_token: makeUnsubscribeToken(to),
  });
  return { ok: result.ok, to, error: result.error };
}

/** Rendered preview for the Content step (no send, no tracking). */
export async function previewFounderEmail(campaignId: string, campaignFounderId: string): Promise<{ subject: string; html: string } | null> {
  const db = marketingDb();
  const campaign = await getMatchCampaign(campaignId);
  if (!campaign) return null;
  const { data } = await db.from("match_campaign_founders").select(SELECT).eq("id", campaignFounderId).eq("campaign_id", campaignId).maybeSingle();
  if (!data) return null;
  return buildFounderMessage(campaign, data as FounderSendRow, await sendContext());
}
