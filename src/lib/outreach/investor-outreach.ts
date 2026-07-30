import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadInvestorContacts } from "@/lib/investors/load-investor-matches";
import { sendEmail } from "@/lib/email/send-email";
import { renderIntroEmail } from "@/lib/outreach/intro-template";
import { buildUnsubscribeUrl, filterUnsubscribed } from "@/lib/outreach/unsubscribe";
import { getOutreachAutomationEnabled, getInvestorMatchConfig, getOutreachMessage } from "@/lib/settings/platform-settings";
import { resolveFounderOutreachConfig, type EffectiveOutreachConfig } from "@/lib/outreach/founder-overrides";
import { getDoNotContactList, matchesDoNotContact } from "@/lib/founder/deploy-preferences";
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";

/** Formats a raise amount as a compact "~$2M" / "~$500K" string. */
function formatRaise(amount: number | null | undefined): string | null {
  if (!amount || amount <= 0) return null;
  if (amount >= 1_000_000) return `~$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `~$${Math.round(amount / 1_000)}K`;
  return `~$${amount}`;
}

// Match/qualification thresholds are admin-controlled (getInvestorMatchConfig).
const DEFAULT_WEEKLY_CAP = 10;
const MAX_AUDIENCE = 50;

/** Live investor email dispatch is OFF until this is explicitly enabled AND the
 *  disclaimer copy is counsel-approved. When off, the pass advances the log
 *  (queued → sent) without dispatching real email — safe for end-to-end testing. */
export function isOutreachLiveSendEnabled(): boolean {
  return process.env.INVESTOR_OUTREACH_LIVE === "true";
}

export type OutreachCampaign = {
  id: string;
  company_id: string;
  status: "pending_approval" | "approved" | "paused" | "completed";
  template_key: string;
  weekly_cap: number;
  paused: boolean;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OutreachRecipient = {
  id: string;
  campaign_id: string;
  investor_ref: string;
  investor_name: string;
  match_score: number;
  status: "queued" | "sent" | "skipped";
  sent_at: string | null;
};

function client(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function listOutreachCampaigns(): Promise<OutreachCampaign[]> {
  try {
    const { data } = await client()
      .from("investor_outreach_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as OutreachCampaign[];
  } catch {
    return [];
  }
}

export async function getCampaignRecipients(campaignId: string): Promise<OutreachRecipient[]> {
  const { data } = await client()
    .from("investor_outreach_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("match_score", { ascending: false });
  return (data ?? []) as OutreachRecipient[];
}

/**
 * Auto-drafts a pending-approval campaign for a company from its in-industry
 * matches (structured profile fit >= threshold) that have an email, if one
 * doesn't already exist. Idempotent (one campaign per company). Targets the same
 * investor set the founder sees on the board — CRM investor contacts, scored by
 * their live profile — not just approved platform accounts.
 */
export async function createDraftFromMatch(companyId: string): Promise<{ created: boolean }> {
  const db = client();
  const { data: existing } = await db
    .from("investor_outreach_campaigns")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();
  if (existing) return { created: false };

  const { data: comp } = await db
    .from("companies")
    .select("funding_amount, revenue_stage, use_of_funds, industry")
    .eq("id", companyId)
    .maybeSingle();
  if (!comp) return { created: false };
  const c = comp as { funding_amount: number | null; revenue_stage: string | null; use_of_funds: string | null; industry: string | null };

  // Admin match/qualification rules (industry required, thresholds).
  const config = await getInvestorMatchConfig();

  // Score every investor's live structured profile against the company (same
  // engine as the founder board), with industry required if configured.
  const scored = await loadInvestorContacts({
    scoreAgainst: { fundingAmount: c.funding_amount, revenue: null, revenueStage: c.revenue_stage, useOfFunds: c.use_of_funds, industry: c.industry },
    investorsOnly: true,
    requireIndustryMatch: config.requiredFields.industry,
    weights: config.weights,
    limit: 3000,
  });
  const candidates = scored.filter((s) => (s.match?.score ?? 0) >= config.minMatch && (s.email ?? "").trim());

  // Investor-score qualification: bridge email → platform account → partner score.
  const emails = [...new Set(candidates.map((s) => s.email!.trim().toLowerCase()))];
  const profileByEmail = new Map<string, string>();
  if (emails.length > 0) {
    const { data: profs } = await db.from("profiles").select("id, email").in("email", emails);
    for (const p of (profs ?? []) as Array<{ id: string; email: string | null }>) {
      if (p.email) profileByEmail.set(p.email.trim().toLowerCase(), p.id);
    }
  }
  const profileIds = [...new Set([...profileByEmail.values()])];
  const scoreByProfile = profileIds.length > 0 ? await loadPartnerScoresBatch(db, profileIds) : new Map();

  const ranked = candidates
    .filter((s) => {
      const pid = profileByEmail.get(s.email!.trim().toLowerCase());
      const ps = pid ? scoreByProfile.get(pid) : undefined;
      const rated = ps?.status === "rated" && typeof ps.score === "number";
      // Rated → must clear the score minimum; unrated ("New") → passes unless
      // the admin requires a rated score.
      return rated ? (ps!.score as number) >= config.minInvestorScore : !config.requireRated;
    })
    .slice(0, MAX_AUDIENCE);
  if (ranked.length === 0) return { created: false };

  const { data: campaign } = await db
    .from("investor_outreach_campaigns")
    .insert({ company_id: companyId, status: "pending_approval", weekly_cap: DEFAULT_WEEKLY_CAP })
    .select("id")
    .single();
  if (!campaign) return { created: false };

  const rows = ranked.map((s) => ({
    campaign_id: (campaign as { id: string }).id,
    investor_ref: s.id, // crm_contact id
    investor_name: s.name,
    email: s.email,
    match_score: s.match?.score ?? 0,
    status: "queued",
  }));
  await db.from("investor_outreach_recipients").upsert(rows, { onConflict: "campaign_id,investor_ref", ignoreDuplicates: true });

  return { created: true };
}

/**
 * Founder-automatic outreach: ensure the company has an outreach campaign and
 * that it's approved, attributing the approval to the founder who owns it.
 *
 * This is the "runs automatically once your Investable Score clears the
 * threshold" path — the founder's own authorization stands in for the admin
 * approval step (counsel-approved). Idempotent: safe to call on every page load.
 * Real email dispatch is still gated by INVESTOR_OUTREACH_LIVE; this only queues.
 * A paused campaign is left paused (the founder's off switch is respected).
 */
export async function ensureFounderAutomatedOutreach(
  companyId: string,
  founderId: string,
): Promise<void> {
  await createDraftFromMatch(companyId);
  await client()
    .from("investor_outreach_campaigns")
    .update({
      status: "approved",
      approved_by: founderId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("status", "pending_approval");
}

/** Founder-facing outreach state for a company's campaign. */
export async function getFounderOutreachStatus(
  companyId: string,
): Promise<{ exists: boolean; paused: boolean }> {
  const { data } = await client()
    .from("investor_outreach_campaigns")
    .select("paused")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return { exists: false, paused: false };
  return { exists: true, paused: Boolean((data as { paused: boolean }).paused) };
}

/**
 * Founder pause/resume for their OWN company's automated outreach — the
 * founder-facing off switch that doesn't need an env change. Verifies the
 * founder owns the company before touching anything. Returns false if the
 * founder doesn't own the company or has no campaign yet.
 */
export async function setFounderOutreachPaused(
  companyId: string,
  founderId: string,
  paused: boolean,
): Promise<boolean> {
  const db = client();
  const { data: owned } = await db
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("founder_id", founderId)
    .maybeSingle();
  if (!owned) return false;

  const { error } = await db
    .from("investor_outreach_campaigns")
    .update({ paused, updated_at: new Date().toISOString() })
    .eq("company_id", companyId);
  return !error;
}

export async function approveCampaign(campaignId: string, adminId: string): Promise<boolean> {
  const { error } = await client()
    .from("investor_outreach_campaigns")
    .update({ status: "approved", approved_by: adminId, approved_at: new Date().toISOString(), paused: false, updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("status", "pending_approval");
  return !error;
}

export async function setCampaignPaused(campaignId: string, paused: boolean): Promise<boolean> {
  const { error } = await client()
    .from("investor_outreach_campaigns")
    .update({ paused, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  return !error;
}

export async function setCampaignWeeklyCap(campaignId: string, cap: number): Promise<boolean> {
  const clamped = Math.max(5, Math.min(20, Math.round(cap)));
  const { error } = await client()
    .from("investor_outreach_campaigns")
    .update({ weekly_cap: clamped, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  return !error;
}

/**
 * Weekly send pass. For each APPROVED, non-paused campaign that hasn't run in the
 * last ~6 days, advance up to `weekly_cap` queued recipients. Real email dispatch
 * only happens when INVESTOR_OUTREACH_LIVE=true; otherwise the log advances
 * (queued → sent) so the flow is fully testable without emailing anyone.
 */
export async function processApprovedOutreach(): Promise<{ campaignsRun: number; recipientsSent: number; liveSend: boolean }> {
  const db = client();
  const live = await getOutreachAutomationEnabled();
  const outreachMessage = live ? await getOutreachMessage() : null;
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  // Admin automation ON = fully automatic: auto-approve any drafts still pending
  // so flipping the switch picks up existing (and future) matches with no gate.
  if (live) {
    await db
      .from("investor_outreach_campaigns")
      .update({ status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("status", "pending_approval")
      .eq("paused", false);
  }

  const { data: campaigns } = await db
    .from("investor_outreach_campaigns")
    .select("*")
    .eq("status", "approved")
    .eq("paused", false)
    .or(`last_run_at.is.null,last_run_at.lt.${sixDaysAgo}`);

  const list = (campaigns ?? []) as OutreachCampaign[];
  let campaignsRun = 0;
  let recipientsSent = 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthStart = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); })();

  for (const campaign of list) {
    const now = new Date().toISOString();

    // Resolve this founder's EFFECTIVE config (global defaults + plan cap +
    // per-founder override): the monthly cap, schedule, pause, and message.
    let eff: EffectiveOutreachConfig | null = null;
    {
      const { data: cRow } = await db.from("companies").select("founder_id").eq("id", campaign.company_id).maybeSingle();
      const founderId = (cRow as { founder_id?: string } | null)?.founder_id ?? null;
      if (founderId) eff = await resolveFounderOutreachConfig({ id: campaign.company_id, founder_id: founderId });
    }

    // Gate BEFORE claiming so we don't burn last_run_at: automation pause (global
    // or per-founder, until its resume date) and a not-yet-reached start date both
    // hold the whole campaign.
    if (eff) {
      if (eff.pause.enabled && (!eff.pause.until || eff.pause.until >= todayIso)) continue;
      if (eff.startDate && todayIso < eff.startDate) continue;
    }

    // Atomically claim this campaign for this run by advancing last_run_at under
    // the same freshness guard. A concurrent run's identical update won't match
    // (last_run_at is now recent), so it can't double-send the same campaign.
    const { data: claimed } = await db
      .from("investor_outreach_campaigns")
      .update({ last_run_at: now, updated_at: now })
      .eq("id", campaign.id)
      .eq("status", "approved")
      .eq("paused", false)
      .or(`last_run_at.is.null,last_run_at.lt.${sixDaysAgo}`)
      .select("id");
    if (!claimed || (claimed as Array<{ id: string }>).length === 0) continue;

    // Per-run slice = the campaign weekly cap, further clamped by how much of the
    // founder's MONTHLY plan cap is still left this calendar month.
    let batchLimit = campaign.weekly_cap;
    if (eff) {
      const { count } = await db
        .from("investor_outreach_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "sent")
        .gte("sent_at", monthStart);
      const sentThisMonth = typeof count === "number" ? count : 0;
      const remaining = Math.max(0, eff.monthlyCap - sentThisMonth);
      batchLimit = Math.max(0, Math.min(campaign.weekly_cap, remaining));
    }
    // Monthly cap reached — send nothing this run; it resumes next month.
    if (batchLimit === 0) continue;

    const { data: queued } = await db
      .from("investor_outreach_recipients")
      .select("id, investor_ref, investor_name, email")
      .eq("campaign_id", campaign.id)
      .eq("status", "queued")
      .order("match_score", { ascending: false })
      .limit(batchLimit);

    const batch = (queued ?? []) as Array<{ id: string; investor_ref: string; investor_name: string; email: string | null }>;
    if (batch.length === 0) {
      await db.from("investor_outreach_campaigns").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", campaign.id);
      continue;
    }

    if (!live) {
      // Flag OFF: advance the log without dispatching real email (safe testing).
      await db
        .from("investor_outreach_recipients")
        .update({ status: "sent", sent_at: now })
        .in("id", batch.map((r) => r.id));
      recipientsSent += batch.length;
    } else {
      // Flag ON: render the locked intro_fit_v1 template and dispatch via the
      // platform email sender. Members only — prospects have no verified email
      // and are excluded from outreach audiences.
      const { data: companyRow } = await db
        .from("companies")
        .select("company_name, industry, revenue_stage, slug, is_published, business_description, funding_amount, country, state")
        .eq("id", campaign.company_id)
        .maybeSingle();
      const comp = (companyRow ?? {}) as {
        company_name?: string;
        industry?: string | null;
        revenue_stage?: string | null;
        slug?: string | null;
        is_published?: boolean | null;
        business_description?: string | null;
        funding_amount?: number | null;
        country?: string | null;
        state?: string | null;
      };

      // The email IS the Founder Preview one-pager. If the founder hasn't
      // published one, there's nothing to send — leave recipients queued so they
      // go out on a later run once the page is live (never burned as "skipped").
      const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
      const previewUrl = comp.is_published && comp.slug ? `${appBase}/f/${comp.slug}` : null;
      if (!previewUrl) {
        continue;
      }
      const tagline = comp.business_description ?? null;
      const raise = formatRaise(comp.funding_amount);
      const location = [comp.state, comp.country].filter(Boolean).join(", ") || null;

      // CAN-SPAM: never send to a suppressed address. The email is stored on the
      // recipient at enroll time (the matched investor's CRM email).
      const emails = batch.map((r) => r.email).filter((e): e is string => Boolean(e));
      const suppressed = await filterUnsubscribed(emails);
      // The founder's own do-not-contact list (emails or domains) suppresses on
      // top of the global unsubscribe list.
      const doNotContact = await getDoNotContactList(campaign.company_id);

      for (const r of batch) {
        const email = r.email;
        // No email, globally unsubscribed, or on the founder's do-not-contact → terminal skip.
        if (!email || suppressed.has(email.trim().toLowerCase()) || matchesDoNotContact(email, doNotContact)) {
          await db.from("investor_outreach_recipients").update({ status: "skipped" }).eq("id", r.id);
          continue;
        }
        const firstName = (r.investor_name ?? "").trim().split(/\s+/)[0] || null;
        const { subject, html, text } = renderIntroEmail({
          company: comp.company_name ?? "a company",
          sector: comp.industry ?? null,
          stage: comp.revenue_stage ?? null,
          investorFirstName: firstName,
          unsubscribeUrl: buildUnsubscribeUrl(email),
          previewUrl,
          tagline,
          raise,
          location,
          message: eff?.message ?? outreachMessage ?? undefined,
        });
        const ok = await sendEmail({ to: email, subject, html, text });
        if (ok) {
          await db
            .from("investor_outreach_recipients")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", r.id);
          recipientsSent += 1;
        }
        // On send failure, leave the recipient queued so a later run retries it —
        // a transient email outage must not silently drop people from the campaign.
      }
    }

    // last_run_at was already set atomically at claim time above.
    campaignsRun += 1;
  }

  return { campaignsRun, recipientsSent, liveSend: live };
}
