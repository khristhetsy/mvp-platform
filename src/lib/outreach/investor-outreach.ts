import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rankInvestorsForCompany } from "@/lib/matching/investor-company-matching";
import {
  loadAdminCompanyMatchProfiles,
  loadApprovedInvestorMatchProfiles,
} from "@/lib/matching/load-matching-data";

const STRONG_MATCH_THRESHOLD = 70;
const DEFAULT_WEEKLY_CAP = 10;
const MAX_AUDIENCE = 50;

/** Live investor email dispatch is OFF until this is explicitly enabled AND the
 *  disclaimer copy is counsel-approved. When off, the pass advances the log
 *  (queued → sent) without dispatching real email — safe for end-to-end testing. */
function outreachLiveSendEnabled(): boolean {
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
  const live = outreachLiveSendEnabled();
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
    const { data: queued } = await db
      .from("investor_outreach_recipients")
      .select("id")
      .eq("campaign_id", campaign.id)
      .eq("status", "queued")
      .order("match_score", { ascending: false })
      .limit(campaign.weekly_cap);

    const batch = (queued ?? []) as Array<{ id: string }>;
    if (batch.length === 0) {
      await db.from("investor_outreach_campaigns").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", campaign.id);
      continue;
    }

    // NOTE: when `live` is true, dispatch the counsel-approved intro_fit_v1
    // template to each recipient here via the platform email sender. Left as a
    // guarded no-op until the disclaimer copy is approved and the flag is set.
    const now = new Date().toISOString();
    await db
      .from("investor_outreach_recipients")
      .update({ status: "sent", sent_at: now })
      .in("id", batch.map((r) => r.id));

    await db.from("investor_outreach_campaigns").update({ last_run_at: now, updated_at: now }).eq("id", campaign.id);

    campaignsRun += 1;
    recipientsSent += batch.length;
  }

  return { campaignsRun, recipientsSent, liveSend: live };
}
