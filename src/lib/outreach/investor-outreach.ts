import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rankInvestorsForCompany } from "@/lib/matching/investor-company-matching";
import {
  loadAdminCompanyMatchProfiles,
  loadApprovedInvestorMatchProfiles,
} from "@/lib/matching/load-matching-data";
import { sendEmail } from "@/lib/email/send-email";
import { renderIntroEmail } from "@/lib/outreach/intro-template";
import { buildUnsubscribeUrl, filterUnsubscribed } from "@/lib/outreach/unsubscribe";
import { isProspectInvestorId } from "@/lib/matching/prospect-investors";

const STRONG_MATCH_THRESHOLD = 70;
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
 * Auto-drafts a pending-approval campaign for a company from its strong member
 * matches, if one doesn't already exist. Idempotent (one campaign per company).
 * Prospects are excluded — outreach targets real, approved investors only.
 */
export async function createDraftFromMatch(companyId: string): Promise<{ created: boolean }> {
  const db = client();
  const { data: existing } = await db
    .from("investor_outreach_campaigns")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();
  if (existing) return { created: false };

  const [companies, investors] = await Promise.all([
    loadAdminCompanyMatchProfiles(),
    loadApprovedInvestorMatchProfiles(),
  ]);
  const company = companies.find((c) => c.id === companyId);
  if (!company) return { created: false };

  const ranked = rankInvestorsForCompany(company, investors, MAX_AUDIENCE)
    .filter((row) => row.match.matchScore >= STRONG_MATCH_THRESHOLD);
  if (ranked.length === 0) return { created: false };

  const { data: campaign } = await db
    .from("investor_outreach_campaigns")
    .insert({ company_id: companyId, status: "pending_approval", weekly_cap: DEFAULT_WEEKLY_CAP })
    .select("id")
    .single();
  if (!campaign) return { created: false };

  const rows = ranked.map((row) => ({
    campaign_id: (campaign as { id: string }).id,
    investor_ref: row.investor.profile_id,
    investor_name: row.investor.investor_type ?? "Investor",
    match_score: row.match.matchScore,
    status: "queued",
  }));
  await db.from("investor_outreach_recipients").upsert(rows, { onConflict: "campaign_id,investor_ref", ignoreDuplicates: true });

  return { created: true };
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
  const live = isOutreachLiveSendEnabled();
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data: campaigns } = await db
    .from("investor_outreach_campaigns")
    .select("*")
    .eq("status", "approved")
    .eq("paused", false)
    .or(`last_run_at.is.null,last_run_at.lt.${sixDaysAgo}`);

  const list = (campaigns ?? []) as OutreachCampaign[];
  let campaignsRun = 0;
  let recipientsSent = 0;

  for (const campaign of list) {
    const now = new Date().toISOString();

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

    const { data: queued } = await db
      .from("investor_outreach_recipients")
      .select("id, investor_ref, investor_name")
      .eq("campaign_id", campaign.id)
      .eq("status", "queued")
      .order("match_score", { ascending: false })
      .limit(campaign.weekly_cap);

    const batch = (queued ?? []) as Array<{ id: string; investor_ref: string; investor_name: string }>;
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
        .select("company_name, industry, revenue_stage")
        .eq("id", campaign.company_id)
        .maybeSingle();
      const comp = (companyRow ?? {}) as { company_name?: string; industry?: string | null; revenue_stage?: string | null };

      const memberIds = batch.map((r) => r.investor_ref).filter((ref) => !isProspectInvestorId(ref));
      const contactById = new Map<string, { email: string | null; name: string | null }>();
      if (memberIds.length > 0) {
        const { data: profs } = await db.from("profiles").select("id, email, full_name").in("id", memberIds);
        for (const p of (profs ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>) {
          contactById.set(p.id, { email: p.email, name: p.full_name });
        }
      }

      // CAN-SPAM: never send to a suppressed address.
      const emails = [...contactById.values()].map((c) => c.email).filter((e): e is string => Boolean(e));
      const suppressed = await filterUnsubscribed(emails);

      for (const r of batch) {
        const contact = contactById.get(r.investor_ref);
        const email = contact?.email ?? null;
        // No email or suppressed (unsubscribed) → terminal skip.
        if (!email || suppressed.has(email.trim().toLowerCase())) {
          await db.from("investor_outreach_recipients").update({ status: "skipped" }).eq("id", r.id);
          continue;
        }
        const firstName = (contact?.name ?? "").trim().split(/\s+/)[0] || null;
        const { subject, html, text } = renderIntroEmail({
          company: comp.company_name ?? "a company",
          sector: comp.industry ?? null,
          stage: comp.revenue_stage ?? null,
          investorFirstName: firstName,
          unsubscribeUrl: buildUnsubscribeUrl(email),
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
