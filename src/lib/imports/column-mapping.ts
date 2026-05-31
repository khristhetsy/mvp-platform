/** Normalize header for fuzzy matching. */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const COLUMN_ALIASES: Record<string, string> = {
  company_name: "company_name",
  company: "company_name",
  companyname: "company_name",
  name: "company_name",
  website: "website",
  url: "website",
  site: "website",
  industry: "industry",
  sector: "preferred_sectors",
  sectors: "preferred_sectors",
  preferred_sectors: "preferred_sectors",
  revenue_stage: "revenue_stage",
  stage: "preferred_stages",
  preferred_stages: "preferred_stages",
  country: "country",
  state: "state",
  funding_amount: "funding_amount",
  funding: "funding_amount",
  raise_amount: "funding_amount",
  business_description: "business_description",
  description: "business_description",
  founder_email: "founder_email",
  founder: "founder_email",
  linkedin: "linkedin_url",
  linkedin_url: "linkedin_url",
  twitter: "twitter_url",
  twitter_url: "twitter_url",
  x_url: "twitter_url",
  crunchbase: "crunchbase_url",
  crunchbase_url: "crunchbase_url",
  notes: "notes",
  note: "note",
  tags: "tags",
  tag: "tags",
  full_name: "full_name",
  investor_name: "investor_name",
  name_investor: "investor_name",
  email: "email",
  investor_email: "email",
  firm: "firm_name",
  firm_name: "firm_name",
  investor_type: "investor_type",
  type: "investor_type",
  check_size_min: "check_size_min",
  check_min: "check_size_min",
  min_check: "check_size_min",
  check_size_max: "check_size_max",
  check_max: "check_size_max",
  max_check: "check_size_max",
  preferred_geographies: "preferred_geographies",
  geography: "geography",
  geographies: "preferred_geographies",
  accredited_status: "accredited_status",
  accredited: "accredited_status",
  investment_thesis: "investment_thesis",
  thesis: "investment_thesis",
  contact_preference: "contact_preference",
  phone: "phone",
  source: "source",
  entity_type: "entity_type",
  entity_email_or_name: "entity_email_or_name",
  entity: "entity_email_or_name",
  personal_website_url: "personal_website_url",
  personal_website: "personal_website_url",
  other_social_url: "other_social_url",
  status: "status",
};

export function autoMapColumns(
  headers: string[],
  targetFields: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedTargets = new Set<string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let target = COLUMN_ALIASES[normalized];

    if (!target && targetFields.includes(normalized)) {
      target = normalized;
    }

    if (target && targetFields.includes(target) && !usedTargets.has(target)) {
      mapping[header] = target;
      usedTargets.add(target);
    }
  }

  return mapping;
}

export function applyColumnMapping(
  raw: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const [sourceHeader, value] of Object.entries(raw)) {
    const target = mapping[sourceHeader];
    if (target) {
      mapped[target] = value?.trim() ?? "";
    }
  }

  return mapped;
}
