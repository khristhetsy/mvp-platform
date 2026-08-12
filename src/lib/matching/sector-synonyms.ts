/**
 * Canonical sector families so semantically-equivalent labels match.
 *
 * Investor contacts and company industries use inconsistent vocabulary — "AI/ML",
 * "Software", "SaaS", "Technology/Web" are all the same family, but naive text
 * overlap misses that (an "AI / ML" company scored 0 against a "Technology/Web"
 * investor). Each variant maps to a family key; two sides align if they share a
 * family, with a raw substring overlap kept as a fallback.
 *
 * Keys are POST-tokenized (split on , ; / |), so "AI/ML" is matched as the
 * separate tokens "ai" and "ml", and "Technology/Web" as "technology" + "web".
 */
const SECTOR_FAMILY: Record<string, string> = {
  // ── Technology ────────────────────────────────────────────────────────────
  ai: "technology",
  ml: "technology",
  "artificial intelligence": "technology",
  "machine learning": "technology",
  software: "technology",
  saas: "technology",
  "software as a service": "technology",
  technology: "technology",
  tech: "technology",
  "deep tech": "technology",
  deeptech: "technology",
  web: "technology",
  internet: "technology",
  it: "technology",
  "information technology": "technology",
  cloud: "technology",
  data: "technology",
  analytics: "technology",
  "b2b software": "technology",
  "enterprise software": "technology",
  cybersecurity: "technology",
  security: "technology",
  // ── Fintech ───────────────────────────────────────────────────────────────
  fintech: "fintech",
  "financial technology": "fintech",
  "financial services": "fintech",
  finance: "fintech",
  payments: "fintech",
  banking: "fintech",
  insurtech: "fintech",
  insurance: "fintech",
  crypto: "fintech",
  blockchain: "fintech",
  // ── Healthcare / life sciences ────────────────────────────────────────────
  healthcare: "healthcare",
  health: "healthcare",
  "health & wellness": "healthcare",
  "health and wellness": "healthcare",
  healthtech: "healthcare",
  biotech: "healthcare",
  biotechnology: "healthcare",
  "life science": "healthcare",
  "life sciences": "healthcare",
  medical: "healthcare",
  medtech: "healthcare",
  pharma: "healthcare",
  pharmaceuticals: "healthcare",
  // ── Consumer ──────────────────────────────────────────────────────────────
  consumer: "consumer",
  "consumer products": "consumer",
  retail: "consumer",
  ecommerce: "consumer",
  "e-commerce": "consumer",
  cpg: "consumer",
  apparel: "consumer",
  // ── Industrial / hardware ─────────────────────────────────────────────────
  manufacturing: "industrial",
  industrial: "industrial",
  hardware: "industrial",
  robotics: "industrial",
  // ── Energy / climate ──────────────────────────────────────────────────────
  energy: "energy",
  cleantech: "energy",
  "clean tech": "energy",
  climate: "energy",
  renewables: "energy",
  // ── Real estate ───────────────────────────────────────────────────────────
  "real estate": "realestate",
  proptech: "realestate",
  // ── Agriculture / food ────────────────────────────────────────────────────
  agriculture: "agriculture",
  agtech: "agriculture",
  food: "agriculture",
  "food/hospitality": "agriculture",
  hospitality: "agriculture",
};

function tokenize(values: string[]): string[] {
  return values.flatMap((value) =>
    value
      .trim()
      .toLowerCase()
      .split(/[,;/|]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

/** The family a sector token belongs to, or the token itself if it's unmapped. */
function familyOf(token: string): string {
  return SECTOR_FAMILY[token] ?? token;
}

/**
 * True when an investor's sectors align with a company's industry — by shared
 * synonym family (so "AI/ML" ↔ "Technology/Web" ↔ "Software" all match), or by a
 * direct substring overlap as a fallback for unmapped/partial labels.
 */
export function sectorsAlign(investorSectors: string[], companyIndustry: string | null): boolean {
  if (!companyIndustry?.trim()) return false;
  const investorTokens = tokenize(investorSectors);
  if (investorTokens.length === 0) return false;
  const companyTokens = tokenize([companyIndustry]);

  const investorFamilies = new Set(investorTokens.map(familyOf));
  const companyFamilies = new Set(companyTokens.map(familyOf));
  for (const family of investorFamilies) {
    if (companyFamilies.has(family)) return true;
  }

  // Fallback: raw substring overlap (e.g. "software" vs "software as a service").
  return investorTokens.some((needle) => companyTokens.some((hay) => hay.includes(needle) || needle.includes(hay)));
}
