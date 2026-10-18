/**
 * The directory's industry list and the matching around it. Records store industries as the
 * option slugs of the "industry" vocabulary list (for example "cyber-security"); the record page
 * only highlights values it finds in that list, so free text never shows as selected.
 * Pure: runs in the browser and on the server.
 */

export const INDUSTRY_OPTIONS: { slug: string; label: string }[] = [
  ["aerospace", "Aerospace"], ["agriculture", "Agriculture"], ["agtech", "AgTech"], ["ai-ml", "AI / ML"], ["apparel", "Apparel"],
  ["artificial-intelligence", "Artificial Intelligence"], ["biotechnology-life-science", "Biotechnology/Life Science"], ["bitcoin", "Bitcoin"],
  ["blockchain", "Blockchain"], ["business-services", "Business Services"], ["cannabis", "Cannabis"], ["cleantech", "Cleantech"],
  ["communications", "Communications"], ["computer", "Computer"], ["construction", "Construction"], ["consumer-products", "Consumer Products"],
  ["cryptocurrency", "Cryptocurrency"], ["cyber-security", "Cyber Security"], ["data-iot", "Data/IoT"], ["deep-tech", "Deep Tech"],
  ["defense", "Defense"], ["digital-health", "Digital Health"], ["ecommerce", "E-commerce"], ["edtech", "EdTech"], ["energy", "Energy"],
  ["enterprise-software", "Enterprise Software"], ["entertainment", "Entertainment"], ["financial-services", "Financial Services"],
  ["fintech", "Fintech"], ["food-tech", "Food Tech"], ["food-hospitality", "Food/Hospitality"], ["gaming", "Gaming"], ["hardware", "Hardware"],
  ["health-wellness", "Health & Wellness"], ["healthcare", "Healthcare"], ["industrial", "Industrial"], ["insurance", "Insurance"],
  ["logistics", "Logistics"], ["manufacturing", "Manufacturing"], ["marketplace", "Marketplace"], ["materials", "Materials"], ["media", "Media"],
  ["medical-devices", "Medical Devices"], ["mining", "Mining"], ["nano-technology", "Nano Technology"], ["nuclear-waste-recycling", "Nuclear Waste Recycling"],
  ["oil-gas", "Oil & Gas"], ["payment-app", "Payment App"], ["plastics", "Plastics"], ["professional-services", "Professional Services"],
  ["real-estate", "Real Estate"], ["robotics", "Robotics"], ["saas", "SaaS"], ["saas-b2b-software", "SaaS / B2B Software"], ["semiconductor", "Semiconductor"],
  ["software", "Software"], ["telecom", "Telecom"], ["transportation", "Transportation"], ["travel", "Travel"], ["healthtech", "HealthTech"],
  ["warehousing", "Warehousing"], ["other", "Other"],
].map(([slug, label]) => ({ slug, label }));

const BY_SLUG = new Map(INDUSTRY_OPTIONS.map((o) => [o.slug, o]));
const norm = (v: string) => v.toLowerCase().replace(/\([^)]*\)/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
const BY_KEY = new Map<string, string>();
for (const o of INDUSTRY_OPTIONS) { BY_KEY.set(norm(o.label), o.slug); BY_KEY.set(norm(o.slug), o.slug); }

/** Names seen in real files, by normalized text. */
const ALIASES: Record<string, string[]> = {
  cybersecurity: ["cyber-security"], informationsecurity: ["cyber-security"], healthtechdigitalhealth: ["healthtech", "digital-health"],
  digitalhealth: ["digital-health"], healthtech: ["healthtech"], healthcare: ["healthcare"], hospitals: ["healthcare"], medical: ["healthcare"],
  climateenergy: ["cleantech", "energy"], climate: ["cleantech"], lifesciences: ["biotechnology-life-science"], lifescience: ["biotechnology-life-science"],
  biotechnology: ["biotechnology-life-science"], biotech: ["biotechnology-life-science"],
  industrialmanufacturing: ["industrial", "manufacturing"], infrastructuredevelopertools: ["software"], developertools: ["software"],
  cryptoweb3: ["cryptocurrency", "blockchain"], crypto: ["cryptocurrency"], web3: ["blockchain"],
  supplychainlogisticsmobility: ["logistics", "transportation"], supplychain: ["logistics"], consumer: ["consumer-products"], consumerinternet: ["consumer-products"],
  aerospacedefense: ["aerospace", "defense"], foodagriculture: ["agriculture", "food-hospitality"], foodandbeverage: ["food-hospitality"],
  commercemarketplaces: ["ecommerce", "marketplace"], educationfutureofwork: ["edtech"], education: ["edtech"],
  proptechconstruction: ["real-estate", "construction"], proptech: ["real-estate"], gamingmediasports: ["gaming", "media"],
  verticalai: ["ai-ml"], ai: ["ai-ml"], machinelearning: ["ai-ml"], artificialintelligenceai: ["artificial-intelligence"],
  informationtechnology: ["software"], cloudcomputing: ["software"], wellness: ["health-wellness"], payments: ["payment-app"],
  internetofthingsiot: ["data-iot"], internetofthings: ["data-iot"], finance: ["financial-services"], investmentmanagement: ["financial-services"], electronichealthrecords: ["healthtech"], pharmaceuticals: ["biotechnology-life-science"], therapeutics: ["biotechnology-life-science"], antiaging: ["health-wellness"], productivitysoftware: ["software"], newsmedia: ["media"], iot: ["data-iot"], banking: ["financial-services"], telecommunications: ["telecom"],
  autonomousvehicles: ["transportation"], advertising: ["media"], oilandgas: ["oil-gas"],
};

/** Directory industry slugs for one name from a file, or none when nothing fits. A name like "A / B" falls back to its parts. */
export function industrySlugs(name: string): string[] {
  const k = norm(name);
  if (!k) return [];
  const direct = BY_KEY.get(k);
  if (direct) return [direct];
  if (ALIASES[k]) return ALIASES[k];
  if (/[\/;]/.test(name)) {
    const out = new Set<string>();
    for (const part of name.split(/[\/;]/)) for (const s of industrySlugs(part)) out.add(s);
    return [...out];
  }
  return [];
}

export const industryLabel = (slugOrText: string): string => BY_SLUG.get(slugOrText)?.label ?? slugOrText;
export const isIndustrySlug = (v: string): boolean => BY_SLUG.has(v);

/** Split a list into directory slugs and the names that matched nothing. */
export function toIndustrySlugs(items: string[]): { slugs: string[]; leftover: string[] } {
  const slugs: string[] = [], leftover: string[] = [];
  for (const raw of items) {
    const m = isIndustrySlug(raw) ? [raw] : industrySlugs(raw);
    if (m.length) { for (const s of m) if (!slugs.includes(s)) slugs.push(s); } else if (!leftover.includes(raw)) leftover.push(raw);
  }
  return { slugs, leftover };
}

// ---- suggestions for the Verification queue ----

export type SignalSource = "name" | "domain" | "email" | "profile" | "website";
export type Suggestion = {
  slugs: string[];
  level: "strong" | "possible" | "none";
  /** Per industry slug: which sources pointed at it, with the matched word. */
  signals: { slug: string; source: SignalSource; word: string }[];
};

/** Keyword stems and the industries they point at. Stems are matched at the start of a word. */
const KEYWORDS: [RegExp, string[]][] = [
  [/\b(cyber|infosec|information security|app(lication)? security|zero trust)/, ["cyber-security"]], [/\b(fintech|payments?|lending|banking)/, ["fintech"]],
  [/\b(health|medic|clinic|hospital|pharma|therapeutic)/, ["healthtech", "healthcare"]], [/\b(biotech|bio\b|life ?science|genom)/, ["biotechnology-life-science"]],
  [/\b(crypto|bitcoin|web3|defi)/, ["cryptocurrency"]], [/\bblockchain/, ["blockchain"]], [/\b(artificial intelligence|machine learning|\bai\b|\bml\b)/, ["ai-ml"]],
  [/\b(saas|b2b software)/, ["saas"]], [/\b(software|developer tools?)/, ["software"]], [/\benterprise/, ["enterprise-software"]],
  [/\b(agri|farm|agtech)/, ["agriculture"]], [/\b(food|beverage|restaurant)/, ["food-tech"]], [/\b(clean ?tech|climate|solar|renewable|carbon)/, ["cleantech"]],
  [/\b(energy|battery|batteries)/, ["energy"]], [/\b(aerospace|satellites?|space ?tech|spacecraft|launch vehicles?)/, ["aerospace"]], [/\bdefense/, ["defense"]], [/\b(edtech|education|e-?learning|online learning)/, ["edtech"]],
  [/\b(real estate|proptech|property)/, ["real-estate"]], [/\b(gaming|games?|esports)/, ["gaming"]], [/\b(media|entertainment)/, ["media"]],
  [/\brobot/, ["robotics"]], [/\b(semiconductor|chips?)\b/, ["semiconductor"]], [/\b(hardware|devices?)\b/, ["hardware"]], [/\b(logistics|supply chain)/, ["logistics"]],
  [/\b(e-?commerce|retail)/, ["ecommerce"]], [/\bmarketplace/, ["marketplace"]], [/\binsur/, ["insurance"]], [/\b(manufactur|industrial)/, ["manufacturing"]],
  [/\b(deep ?tech)/, ["deep-tech"]], [/\b(medical devices?|medtech)/, ["medical-devices"]], [/\b(travel|hospitality)/, ["travel"]],
];

function scan(text: string, source: SignalSource, into: Suggestion["signals"]) {
  const t = text.toLowerCase();
  for (const [re, slugs] of KEYWORDS) {
    const m = re.exec(t);
    if (m) for (const slug of slugs) if (!into.some((s) => s.slug === slug && s.source === source)) into.push({ slug, source, word: m[0].trim() });
  }
}

/** Domain stems are long enough to match inside a run of letters, such as "pearhealth.com". */
const DOMAIN_STEMS = ["health", "cyber", "secur", "fintech", "crypto", "block", "agri", "cleantech", "solar", "space", "aero", "robot", "game", "food", "bio", "med"];

/**
 * Suggest industries from what the record already holds. Strong means two or more different sources
 * agree on an industry; possible means one source; none means nothing matched. Never reads anything
 * that is not on the record or in the website text the admin asked for.
 */
export function suggestIndustries(input: { firm: string; website?: string | null; emailDomain?: string | null; profile?: string | null; siteText?: string | null }): Suggestion {
  const signals: Suggestion["signals"] = [];
  scan(input.firm, "name", signals);
  const hostOf = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/?#]/)[0].split(".")[0];
  for (const [value, source] of [[input.website, "domain"], [input.emailDomain, "email"]] as const) {
    const host = hostOf(value);
    if (!host) continue;
    for (const stem of DOMAIN_STEMS) {
      if (!host.includes(stem)) continue;
      const probe = stem === "secur" ? "security" : stem === "block" ? "blockchain" : stem === "agri" ? "agri" : stem === "game" ? "games" : stem === "med" ? "medical" : stem === "bio" ? "biotech" : stem;
      scan(probe, source, signals);
    }
  }
  if (input.profile) scan(input.profile, "profile", signals);
  if (input.siteText) scan(input.siteText, "website", signals);
  const by = new Map<string, Set<SignalSource>>();
  for (const s of signals) { if (!by.has(s.slug)) by.set(s.slug, new Set()); by.get(s.slug)!.add(s.source); }
  const ranked = [...by.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 3);
  const slugs = ranked.map(([slug]) => slug);
  const level = ranked.length === 0 ? "none" : ranked.some(([, src]) => src.size >= 2) ? "strong" : "possible";
  return { slugs, level, signals: signals.filter((s) => slugs.includes(s.slug)) };
}
