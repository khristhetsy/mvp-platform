/**
 * How well an investor's sectors fit a founder's industry, for Match campaigns.
 * Pure.
 *
 * The platform engine's sectorsAlign keeps a raw substring fallback, so
 * "Technology" aligns with "Biotechnology" and a Software only investor counted
 * as a sector match for a biotech founder. Match campaigns gate on this tier
 * instead, so only real fits reach a founder:
 *
 *   exact       an investor sector is the founder's industry (whole label or
 *               whole token, never a substring)
 *   adjacent    an investor sector is listed as adjacent to the founder's
 *               industry in match_sector_adjacency; for an industry with no
 *               rows there, a shared synonym family (healthcare, fintech, ...)
 *   generalist  the investor lists "Agnostic" (or similar), or more than 10
 *               sectors that include an exact or adjacent hit; ranked last
 *   null        no fit: the investor is not a match
 *
 * matched holds the investor's own sector labels that produced the fit, which is
 * what the email and match page show ("Matched on").
 */
import { SECTOR_FAMILY, familyOf, tokenize } from "@/lib/matching/sector-synonyms";

export type SectorTier = "exact" | "adjacent" | "generalist";

export type SectorFit = { tier: SectorTier; matched: string[] };

/** Normalized founder industry label to the labels admin marked adjacent to it. */
export type Adjacency = ReadonlyMap<string, readonly string[]>;

/** More sectors than this marks a generalist. */
export const GENERALIST_SECTOR_COUNT = 10;

const GENERALIST_TOKENS = new Set(["agnostic", "industry agnostic", "sector agnostic", "generalist", "all industries", "all sectors", "any industry", "any sector"]);

export const TIER_RANK: Record<SectorTier, number> = { exact: 0, adjacent: 1, generalist: 2 };

export function normLabel(s: string): string {
  return s.trim().toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ");
}

function labelTokens(label: string): string[] {
  return tokenize([normLabel(label)]);
}

/** True when a and b share a whole label or a whole token. */
function sameLabel(a: string, b: string): boolean {
  if (normLabel(a) === normLabel(b)) return true;
  const bt = new Set(labelTokens(b));
  return labelTokens(a).some((t) => bt.has(t));
}

/** Synonym families a label belongs to, only from mapped tokens (no raw text). */
function mappedFamilies(label: string): Set<string> {
  return new Set(labelTokens(label).filter((t) => t in SECTOR_FAMILY).map(familyOf));
}

export function sectorFit(founderIndustries: readonly string[], investorSectors: readonly string[], adjacency?: Adjacency): SectorFit | null {
  const founders = founderIndustries.map((s) => s.trim()).filter(Boolean);
  const sectors = investorSectors.map((s) => s.trim()).filter(Boolean);
  if (!founders.length || !sectors.length) return null;

  const exact = sectors.filter((s) => founders.some((f) => sameLabel(s, f)));

  const adjacentLabels = founders.flatMap((f) => adjacency?.get(normLabel(f)) ?? []);
  let adjacent: string[];
  if (adjacentLabels.length) {
    adjacent = sectors.filter((s) => !exact.includes(s) && adjacentLabels.some((a) => sameLabel(s, a)));
  } else {
    const fams = new Set(founders.flatMap((f) => [...mappedFamilies(f)]));
    adjacent = sectors.filter((s) => !exact.includes(s) && [...mappedFamilies(s)].some((x) => fams.has(x)));
  }

  const agnostic = sectors.filter((s) => GENERALIST_TOKENS.has(normLabel(s)));
  const hits = [...exact, ...adjacent];
  if (agnostic.length) return { tier: "generalist", matched: hits.length ? hits : agnostic };
  if (sectors.length > GENERALIST_SECTOR_COUNT && hits.length) return { tier: "generalist", matched: hits };
  if (exact.length) return { tier: "exact", matched: exact };
  if (adjacent.length) return { tier: "adjacent", matched: adjacent };
  return null;
}

/** Rows of match_sector_adjacency to a lookup keyed by normalized industry. */
export function buildAdjacency(rows: ReadonlyArray<{ industry: string; adjacent_industry: string }>): Adjacency {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const k = normLabel(r.industry);
    const list = map.get(k) ?? [];
    list.push(r.adjacent_industry);
    map.set(k, list);
  }
  return map;
}
