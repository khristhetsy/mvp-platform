import { buildCompanyMatchProfile } from "@/lib/matching/contact-match";
import { explainMatch, type CompanyMatchProfile, type InvestorMatchProfile } from "@/lib/matching/investor-company-matching";

/** The company profile values the step 1 list scores against (same as Import my matches). */
export type FitDefaults = { industry?: string | null; fundingStage?: string | null; investorTypes?: string | null };

/** The contact fields the matcher can use. */
export type FitContact = {
  id: string;
  investorType: string | null;
  sectors: string | null;
  stages?: string | null;
  geography?: string | null;
};

const list = (v: string | null | undefined): string[] => (v ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);

/** One company profile for the whole list, built once from the founder's own company. */
export function fitCompany(defaults: FitDefaults | undefined): CompanyMatchProfile | null {
  if (!defaults || !(defaults.industry || defaults.fundingStage || defaults.investorTypes)) return null;
  return buildCompanyMatchProfile({
    id: "founder-company",
    industry: defaults.industry ?? null,
    funding_stage: defaults.fundingStage ?? null,
    seeking_investor_types: defaults.investorTypes ?? null,
  });
}

/**
 * Fit for one of the founder's own contacts, 0 to 100, from the same matcher the rest of
 * the platform uses (`explainMatch`). Returns null, shown as "Not scored", when nothing
 * could be compared: no company profile, or the contact has no type, sectors or stages.
 */
export function contactFit(contact: FitContact, company: CompanyMatchProfile | null): number | null {
  if (!company) return null;
  const investor: InvestorMatchProfile = {
    profile_id: contact.id,
    investor_type: contact.investorType,
    check_size_min: null,
    check_size_max: null,
    preferred_sectors: list(contact.sectors),
    preferred_geographies: list(contact.geography),
    preferred_stages: list(contact.stages),
    preferred_arr_range: null,
    preferred_mrr_range: null,
    approval_status: "approved",
  };
  const m = explainMatch(investor, company);
  return m.factors.some((f) => f.evaluated) ? m.matchScore : null;
}
