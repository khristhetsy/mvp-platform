/**
 * /fit v2 sector picker: groups the offerable sectors into a short list of chips.
 *
 * The investor data carries near-duplicate industry spellings ("AI", "AI/ML",
 * "Artificial Intelligence", …). The platform-wide taxonomy in
 * `@/lib/industries/canonical` is left untouched; this grouping is display only.
 * A chip carries every stored value it stands for, and selecting it adds all of
 * them to `answers.industry`. The matcher's industry filter is any-overlap, so
 * matching is unchanged apart from a founder now catching every spelling at once.
 *
 * Nothing is dropped: any offerable sector no chip claims becomes its own chip
 * under "More sectors", so every investor stays reachable.
 */

export type SectorChip = { key: string; label: string; values: string[] };
export type SectorGroup = { name: string; chips: SectorChip[] };

type ChipRule = { label: string; members: string[] };
type GroupRule = { name: string; chips: ChipRule[] };

// Members are compared lowercased. Spellings come from investor_match_index (2026-10-02).
const RULES: GroupRule[] = [
  {
    name: "Technology",
    chips: [
      { label: "AI and Machine Learning", members: ["ai", "ai & ml", "ai/ml", "ai/deep tech", "applied ai", "artificial intelligence", "machine learning"] },
      { label: "Software and SaaS", members: ["software", "saas", "b2b saas", "enterprise software", "enterprise/saas", "enterprise", "enterprise it", "enterprise tech", "vertical software", "cloud", "developer", "developer tools", "devtools", "information services", "technology", "computer"] },
      { label: "Data and IoT", members: ["data/iot", "data"] },
      { label: "Cybersecurity", members: ["cyber security", "cybersecurity"] },
      { label: "Deep Tech and Hardware", members: ["deep tech", "hardware", "robotics", "robotics + hardware", "semiconductor", "semiconductors", "nano technology", "autonomous systems", "automation"] },
      { label: "Crypto and Web3", members: ["bitcoin", "blockchain", "crypto", "cryptocurrency", "defi", "web3"] },
      { label: "Telecom", members: ["telecom", "telecommunications", "communications"] },
    ],
  },
  {
    name: "Health",
    chips: [
      { label: "Healthcare", members: ["healthcare", "health tech", "digital health", "health & wellness"] },
      { label: "Biotech and Life Sciences", members: ["biotech", "biotechnology/life science", "life sciences", "bio + health", "bio + healthcare"] },
      { label: "Medical Devices", members: ["medical devices"] },
    ],
  },
  {
    name: "Finance",
    chips: [
      { label: "Fintech and Payments", members: ["fintech", "payment app"] },
      { label: "Financial Services and Insurance", members: ["financial services", "insurance", "insurtech"] },
    ],
  },
  {
    name: "Climate and Energy",
    chips: [
      { label: "Cleantech and Climate", members: ["cleantech", "climate tech", "sustainability"] },
      { label: "Energy and Resources", members: ["energy", "oil & gas", "nuclear", "nuclear waste recycling", "mining"] },
    ],
  },
  {
    name: "Industry and Logistics",
    chips: [
      { label: "Manufacturing and Industrial", members: ["manufacturing", "industrial", "materials", "plastics", "construction", "infrastructure"] },
      { label: "Aerospace and Defense", members: ["aerospace", "space", "defense"] },
      { label: "Transportation and Logistics", members: ["transportation", "supply chain + automation", "warehousing"] },
    ],
  },
  {
    name: "Food and Agriculture",
    chips: [
      { label: "Agriculture and AgTech", members: ["agriculture", "agtech"] },
      { label: "Food and Hospitality", members: ["food/hospitality", "food tech", "hospitality"] },
    ],
  },
  {
    name: "Consumer",
    chips: [
      { label: "Consumer Products", members: ["consumer", "consumer products", "consumer tech"] },
      { label: "Apparel", members: ["apparel"] },
      { label: "E-commerce and Marketplaces", members: ["e-commerce", "marketplace", "marketplaces"] },
      { label: "Media, Entertainment and Gaming", members: ["media", "entertainment", "gaming"] },
      { label: "Education", members: ["edtech"] },
      { label: "Travel", members: ["travel"] },
      { label: "Cannabis", members: ["cannabis"] },
    ],
  },
  {
    name: "Services and Real Estate",
    chips: [
      { label: "Business and Professional Services", members: ["business services", "professional services"] },
      { label: "Real Estate", members: ["real estate"] },
    ],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Group the offerable sectors (exact stored spellings) into chips. */
export function groupSectors(offerable: string[]): SectorGroup[] {
  const byLower = new Map(offerable.map((s) => [s.trim().toLowerCase(), s]));
  const claimed = new Set<string>();
  const groups: SectorGroup[] = [];

  for (const g of RULES) {
    const chips: SectorChip[] = [];
    for (const c of g.chips) {
      const values = c.members.map((m) => byLower.get(m)).filter((v): v is string => !!v);
      if (values.length === 0) continue; // no investor behind it: not offerable
      values.forEach((v) => claimed.add(v.toLowerCase()));
      chips.push({ key: slug(c.label), label: c.label, values });
    }
    if (chips.length) groups.push({ name: g.name, chips });
  }

  const rest = offerable.filter((s) => !claimed.has(s.trim().toLowerCase()));
  const other = rest.filter((s) => s.trim().toLowerCase() === "other");
  const named = rest.filter((s) => s.trim().toLowerCase() !== "other").sort((a, b) => a.localeCompare(b));
  const more = [...named, ...other].map((s) => ({ key: `x-${slug(s)}`, label: s, values: [s] }));
  if (more.length) groups.push({ name: "More sectors", chips: more });
  return groups;
}

/** Stored industry values for the selected chip keys (deduped). */
export function valuesForChips(groups: SectorGroup[], keys: string[]): string[] {
  const all = groups.flatMap((g) => g.chips);
  return [...new Set(keys.flatMap((k) => all.find((c) => c.key === k)?.values ?? []))];
}
