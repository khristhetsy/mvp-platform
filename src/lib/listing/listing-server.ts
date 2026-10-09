import crypto from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadNotApplicableTypes } from "@/lib/documents/not-applicable";
import { evaluateListingChecklist, type ListingChecklist } from "@/lib/listing/checklist";

/* eslint-disable @typescript-eslint/no-explicit-any */
// New columns (figures_attested_at, listing_opt_in_at, listing_completed_at)
// are not in the generated types yet; same cast the CRR code uses.
type Db = any;

export type CompanyListingState = ListingChecklist & {
  companyId: string;
  figuresAttestedAt: string | null;
  listingOptInAt: string | null;
  listingCompletedAt: string | null;
};

/** The four checks for one company, read fresh. */
export async function loadListingChecklist(companyId: string, db: Db = createServiceRoleClient()): Promise<CompanyListingState> {
  const [{ data: company }, { data: docs }, { data: report }, na] = await Promise.all([
    db.from("companies").select("id, figures_attested_at, listing_opt_in_at, listing_completed_at").eq("id", companyId).maybeSingle(),
    db.from("documents").select("document_type").eq("company_id", companyId),
    db.from("diligence_reports").select("executive_summary").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadNotApplicableTypes(db, companyId).catch(() => [] as string[]),
  ]);
  const row = (company ?? {}) as { figures_attested_at?: string | null; listing_opt_in_at?: string | null; listing_completed_at?: string | null };
  const checklist = evaluateListingChecklist({
    uploadedTypes: ((docs ?? []) as Array<{ document_type: string | null }>).map((d) => d.document_type),
    notApplicableTypes: na,
    report: (report as { executive_summary: string | null } | null) ?? null,
    figuresAttestedAt: row.figures_attested_at ?? null,
    listingOptInAt: row.listing_opt_in_at ?? null,
  });
  return {
    ...checklist,
    companyId,
    figuresAttestedAt: row.figures_attested_at ?? null,
    listingOptInAt: row.listing_opt_in_at ?? null,
    listingCompletedAt: row.listing_completed_at ?? null,
  };
}

/**
 * Stamps listing_completed_at the first time all four checks pass, then queues
 * deal notices to the matched investors. Safe to call after any step: it does
 * nothing until the checklist is complete, and nothing a second time.
 */
export async function markListingCompleteIfReady(companyId: string): Promise<{ completedNow: boolean; queued: number }> {
  const db: Db = createServiceRoleClient();
  const state = await loadListingChecklist(companyId, db);
  if (!state.complete || state.listingCompletedAt) return { completedNow: false, queued: 0 };

  const now = new Date().toISOString();
  const { data: updated } = await db
    .from("companies")
    .update({ listing_completed_at: now })
    .eq("id", companyId)
    .is("listing_completed_at", null)
    .select("id")
    .maybeSingle();
  if (!updated) return { completedNow: false, queued: 0 };

  let queued = 0;
  try {
    queued = await queueDealNotices(companyId);
  } catch (err) {
    console.error("[listing] could not queue deal notices", err);
  }
  try {
    const { notifyCompanyFounder } = await import("@/lib/notifications/notifications");
    await notifyCompanyFounder(companyId, {
      type: "listing_complete",
      title: "You're listed in the Private Market",
      message: queued
        ? `Due diligence is complete. ${queued.toLocaleString("en-US")} matched investors in our network will get a notice about your company.`
        : "Due diligence is complete. Your company is now listed for investors in our network.",
      entityType: "company",
      entityId: companyId,
      deepLink: "/founder/dashboard",
      dedupeKey: `listing_complete:${companyId}`,
    });
  } catch {
    // A missed notification never blocks the listing.
  }
  return { completedNow: true, queued };
}

/** Deal notices use the same match floor as Match campaigns. */
export const DEAL_NOTICE_MIN_SCORE = 70;

export function newNoticeToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

/**
 * Matches one listed company against the investor network (CRM investor
 * contacts, the same engine and floor Match campaigns use) and queues one
 * notice per matched investor. Existing rows are left alone.
 */
export async function queueDealNotices(companyId: string): Promise<number> {
  const db: Db = createServiceRoleClient();
  const { data: company } = await db
    .from("companies")
    .select("id, company_name, slug, industry, revenue_stage, funding_stage, operating_stage, seeking_investor_types, seeking_capital_types, state, country, funding_amount, funding_amount_band, arr, mrr")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return 0;

  const [{ loadMatchingShared }, { matchFounder }, { buildCompanyMatchProfile }] = await Promise.all([
    import("@/lib/marketing/match-campaign/store"),
    import("@/lib/marketing/match-campaign/matcher"),
    import("@/lib/matching/contact-match"),
  ]);
  const { investors, matchCfg, adjacency } = await loadMatchingShared();
  const profile = buildCompanyMatchProfile(company);
  const industries = String(company.industry ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
  const matches = matchFounder(profile, investors, matchCfg.engineWeights, DEAL_NOTICE_MIN_SCORE, {
    founderIndustries: industries,
    adjacency,
  });
  if (!matches.length) return 0;

  const rows = matches.map((m) => ({
    company_id: companyId,
    crm_contact_id: m.investor_contact_id,
    match_score: m.match_score,
    status: "queued",
    token: newNoticeToken(),
  }));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await db
      .from("listing_deal_notices")
      .upsert(rows.slice(i, i + 500), { onConflict: "company_id,crm_contact_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Could not queue deal notices: ${error.message}`);
    inserted += (data ?? []).length;
  }
  return inserted;
}
