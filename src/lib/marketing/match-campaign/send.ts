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
import { renderFollowUpEmail, renderFounderEmail, renderReviewEmail, renderSubject, DEFAULT_SUBJECT, REVIEW_SUBJECT, UNNAMED } from "./email";
import { investorIdentity } from "./matcher";
import { investorNetworkCount, networkLabel } from "./investors";
import { makeFounderToken } from "./token";
import { getMatchCampaign, type MatchCampaignRow } from "./store";
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
    : renderFounderEmail({ ...base, links });
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

  const { data } = await db
    .from("match_campaign_founders")
    .select(SELECT)
    .eq("campaign_id", campaignId)
    .eq("send_status", "pending")
    .is("excluded_reason", null)
    .gt("match_count", 0)
    .order("created_at", { ascending: true })
    .limit(room);
  const batch = (data ?? []) as FounderSendRow[];
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
      await db.from("match_campaign_founders").update({ send_status: "dry_run", sent_at: now, updated_at: now }).eq("id", f.id);
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


/** Founders followed up per cron pass. */
const FOLLOW_UP_BATCH = 50;
const DAY_MS = 86_400_000;

/**
 * The one follow up email of the review flow: a founder who opened an investor
 * profile at least 24 hours ago, has not booked a match review or started a
 * plan, and has not been followed up yet, gets one email naming the investor
 * they viewed last. Only real sends (not dry runs or internal addresses), only
 * review flow campaigns, never to an unsubscribed address. Runs on the 15
 * minute marketing cron.
 */
export async function sendMatchFollowUps(now: Date = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const db = marketingDb();
  const cutoff = new Date(now.getTime() - DAY_MS).toISOString();
  const { data } = await db
    .from("match_campaign_founders")
    .select("id, campaign_id, email, company")
    .eq("send_status", "sent")
    .not("first_profile_view_at", "is", null)
    .lte("first_profile_view_at", cutoff)
    .is("booked_at", null)
    .is("plan_started_at", null)
    .is("followup_sent_at", null)
    .order("first_profile_view_at", { ascending: true })
    .limit(FOLLOW_UP_BATCH);
  const rows = (data ?? []) as Array<{ id: string; campaign_id: string; email: string | null; company: string | null }>;
  let sent = 0, skipped = 0, failed = 0;
  const campaigns = new Map<string, MatchCampaignRow | null>();
  for (const f of rows) {
    const stamp = new Date().toISOString();
    if (!campaigns.has(f.campaign_id)) campaigns.set(f.campaign_id, await getMatchCampaign(f.campaign_id));
    const campaign = campaigns.get(f.campaign_id) ?? null;
    // Mark first, so a failure below never sends twice.
    await db.from("match_campaign_founders").update({ followup_sent_at: stamp }).eq("id", f.id).is("followup_sent_at", null);
    if (!campaign || campaign.match_config.flow !== "review" || campaign.match_config.dry_run || !f.email || (await isUnsubscribed(f.email)) || isInternalAccount({ email: f.email, role: "founder" })) {
      skipped++;
      continue;
    }
    const { data: view } = await db
      .from("match_campaign_profile_views")
      .select("match_id")
      .eq("campaign_founder_id", f.id)
      .order("viewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const matchId = (view as { match_id: string } | null)?.match_id;
    let investorName = UNNAMED;
    if (matchId) {
      const { data: m } = await db.from("match_campaign_matches").select("investor_contact_id").eq("id", matchId).maybeSingle();
      const contactId = (m as { investor_contact_id: string } | null)?.investor_contact_id;
      if (contactId) {
        const { data: c } = await db.from("crm_contacts").select("name, company").eq("id", contactId).maybeSingle();
        const who = c as { name: string | null; company: string | null } | null;
        investorName = investorIdentity(who?.name, who?.company).investor_name ?? UNNAMED;
      }
    }
    const token = makeFounderToken(f.id);
    const { subject, html } = renderFollowUpEmail({
      company: f.company?.trim() || "your company",
      investorName,
      links: { call: `${appUrl()}/mc/${token}?a=call`, privacy: `${appUrl()}/privacy` },
      postalAddress: postalAddress(),
    });
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
    });
    if (result.ok) sent++;
    else failed++;
    await new Promise((r) => setTimeout(r, 200));
  }
  return { sent, skipped, failed };
}
