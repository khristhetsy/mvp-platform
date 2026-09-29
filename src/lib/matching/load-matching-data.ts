import { listMarketplaceListings } from "@/lib/data/marketplace";
import { crrScoresFor } from "@/lib/crr/crr-for";
import {
  countHighMatches,
  matchInvestorToCompany,
  type CompanyMatchProfile,
  type InvestorMatchProfile,
} from "@/lib/matching/investor-company-matching";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import { splitProfileCsv } from "@/lib/profile/options";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";

function formatGeography(company: Pick<Company, "state" | "country">) {
  const parts = [company.state, company.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Combine funding stage + operating stage + revenue stage into one haystack so
 *  all three feed the engine's stage factor (token overlap vs investor stages). */
/**
 * The company's stage for matching: its funding stage (Pre-seed, Seed, Series A,
 * Series B, Growth), the one stage vocabulary investors pick from. Operating and
 * revenue stage no longer feed this factor; revenue is scored by ARR and MRR.
 */
function combinedStage(company: Company): string | null {
  const raw = (company as unknown as Record<string, unknown>).funding_stage;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function companyToMatchProfile(
  company: Company,
  input?: { readinessScore?: number | null; slug?: string | null },
): CompanyMatchProfile {
  const cx = company as unknown as Record<string, unknown>;
  const soughtInvestorTypes = splitProfileCsv(cx.seeking_investor_types);
  const soughtCapitalTypes = splitProfileCsv(cx.seeking_capital_types);
  return {
    id: company.id,
    companyName: company.company_name,
    slug: input?.slug ?? company.slug,
    industry: company.industry,
    stage: combinedStage(company),
    geography: formatGeography(company),
    fundingAmount: company.funding_amount,
    fundingBand: typeof cx.funding_amount_band === "string" && cx.funding_amount_band ? cx.funding_amount_band : null,
    readinessScore: input?.readinessScore ?? null,
    onboardingPercent: company.onboarding_progress_percent ?? 0,
    reviewStatus: company.review_status ? String(company.review_status) : company.status,
    isPublished: Boolean(company.is_published),
    marketplaceVisible: Boolean(company.marketplace_visible),
    publishedAt: company.published_at ?? null,
    ...(soughtInvestorTypes.length ? { soughtInvestorTypes } : {}),
    ...(soughtCapitalTypes.length ? { soughtCapitalTypes } : {}),
  };
}

export async function loadMarketplaceCompanyMatchProfiles(supabase: SupabaseClient<Database>) {
  const listings = await listMarketplaceListings(supabase);
  const admin = createServiceRoleClient();

  const companyIds = listings.map((listing) => listing.id);
  const readinessByCompany = new Map<string, number>();

  if (companyIds.length > 0) {
    const { data: reports } = await admin
      .from("diligence_reports")
      .select("company_id, readiness_score, created_at")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false });

    for (const report of reports ?? []) {
      if (!readinessByCompany.has(report.company_id) && report.readiness_score != null) {
        readinessByCompany.set(report.company_id, report.readiness_score);
      }
    }
  }

  const profiles: CompanyMatchProfile[] = [];

  for (const listing of listings) {
    profiles.push({
      id: listing.id,
      companyName: listing.companyName,
      slug: listing.slug,
      industry: listing.industry,
      stage: listing.stage,
      geography: listing.location,
      fundingAmount: parseFundingTarget(listing.fundingTarget),
      readinessScore: readinessByCompany.get(listing.id) ?? null,
      onboardingPercent: 100,
      reviewStatus: "approved",
      isPublished: true,
      marketplaceVisible: true,
      publishedAt: listing.publishedAt,
    });
  }

  return profiles;
}

function parseFundingTarget(value: string | null) {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export async function loadApprovedInvestorMatchProfiles() {
  const admin = createServiceRoleClient();
  // Page through the full table — PostgREST caps a select at ~1000 rows, so
  // without this the matching pool silently stops at the first 1000 approved
  // investors once the platform grows past that.
  const pageSize = 1000;
  const all: InvestorMatchProfile[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("investor_profiles")
      .select(
        "profile_id, investor_type, check_size_min, check_size_max, preferred_sectors, preferred_geographies, preferred_stages, preferred_arr_range, preferred_mrr_range, approval_status",
      )
      .eq("approval_status", "approved")
      .order("profile_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load investor profiles for matching: ${error.message}`);
    }

    const rows = (data ?? []) as InvestorMatchProfile[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }

  return all;
}

export async function loadAdminCompanyMatchProfiles() {
  const admin = createServiceRoleClient();
  const { data: companies, error } = await admin.from("companies").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load companies for matching: ${error.message}`);
  }

  const companyIds = (companies ?? []).map((row) => row.id);
  const readinessByCompany = new Map<string, number>();

  if (companyIds.length > 0) {
    // The CRR engine score — the same number the founder, the admin and the
    // investor see. This used to read diligence_reports with a document-type
    // count as fallback, so matching ran on a figure nothing else agreed with.
    for (const [id, score] of await crrScoresFor(companyIds)) readinessByCompany.set(id, score);
  }

  return (companies ?? []).map((company) =>
    companyToMatchProfile(company as Company, {
      readinessScore: readinessByCompany.get(company.id) ?? null,
    }),
  );
}

export async function loadFounderCompanyMatchContext(company: Company) {
  // Same engine score the rest of the platform reads.
  const readinessScore = (await crrScoresFor([company.id])).get(company.id) ?? null;

  const profile = companyToMatchProfile(company, { readinessScore });
  const [investors, cfg] = await Promise.all([
    loadApprovedInvestorMatchProfiles(),
    getInvestorMatchConfig(),
  ]);
  const scored = investors.map((investor) => matchInvestorToCompany(investor, profile, cfg.engineWeights));

  return {
    companyProfile: profile,
    strongMatchCount: countHighMatches(scored, 70),
    approvedInvestorCount: investors.length,
  };
}