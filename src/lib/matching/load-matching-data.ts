import { listMarketplaceListings } from "@/lib/data/marketplace";
import { computeReadinessScore } from "@/lib/data/founder-readiness";
import {
  countHighMatches,
  matchInvestorToCompany,
  type CompanyMatchProfile,
  type InvestorMatchProfile,
} from "@/lib/matching/investor-company-matching";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";

function formatGeography(company: Pick<Company, "state" | "country">) {
  const parts = [company.state, company.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function companyToMatchProfile(
  company: Company,
  input?: { readinessScore?: number | null; slug?: string | null },
): CompanyMatchProfile {
  return {
    id: company.id,
    companyName: company.company_name,
    slug: input?.slug ?? company.slug,
    industry: company.industry,
    stage: company.revenue_stage,
    geography: formatGeography(company),
    fundingAmount: company.funding_amount,
    readinessScore: input?.readinessScore ?? null,
    onboardingPercent: company.onboarding_progress_percent ?? 0,
    reviewStatus: company.review_status ? String(company.review_status) : company.status,
    isPublished: Boolean(company.is_published),
    marketplaceVisible: Boolean(company.marketplace_visible),
    publishedAt: company.published_at ?? null,
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
  const { data, error } = await admin
    .from("investor_profiles")
    .select(
      "profile_id, investor_type, check_size_min, check_size_max, preferred_sectors, preferred_geographies, preferred_stages, approval_status",
    )
    .eq("approval_status", "approved");

  if (error) {
    throw new Error(`Failed to load investor profiles for matching: ${error.message}`);
  }

  return (data ?? []) as InvestorMatchProfile[];
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

    const { data: documents } = await admin
      .from("documents")
      .select("company_id, document_type")
      .in("company_id", companyIds);

    for (const company of companies ?? []) {
      if (!readinessByCompany.has(company.id)) {
        const docs = (documents ?? []).filter((doc) => doc.company_id === company.id);
        const types = docs.flatMap((doc) => (doc.document_type ? [doc.document_type] : []));
        readinessByCompany.set(company.id, computeReadinessScore(types));
      }
    }
  }

  return (companies ?? []).map((company) =>
    companyToMatchProfile(company as Company, {
      readinessScore: readinessByCompany.get(company.id) ?? null,
    }),
  );
}

export async function loadFounderCompanyMatchContext(company: Company) {
  const admin = createServiceRoleClient();
  const { data: report } = await admin
    .from("diligence_reports")
    .select("readiness_score")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let readinessScore = report?.readiness_score ?? null;
  if (readinessScore == null) {
    const { data: documents } = await admin
      .from("documents")
      .select("document_type")
      .eq("company_id", company.id);
    const types = (documents ?? []).flatMap((doc) => (doc.document_type ? [doc.document_type] : []));
    readinessScore = computeReadinessScore(types);
  }

  const profile = companyToMatchProfile(company, { readinessScore });
  const investors = await loadApprovedInvestorMatchProfiles();
  const scored = investors.map((investor) => matchInvestorToCompany(investor, profile));

  return {
    companyProfile: profile,
    strongMatchCount: countHighMatches(scored, 70),
    approvedInvestorCount: investors.length,
  };
}