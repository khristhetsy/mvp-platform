/**
 * The one definition of "these two match".
 *
 * The staff board and the public event page both put a number on the same
 * thing, and a visitor comparing "2,217 matches" on the page with the board
 * would be right to expect them to agree. So the rule lives here once, and
 * both read it rather than each carrying a copy that drifts.
 */

export type Matchable = {
  role: "investor" | "founder";
  sectors: string[];
  /** Investor: stages they back. Founder: their one stage. Funding stage labels. */
  stages?: string[];
  /** Investor: typical check. Founder: round size. Dollars; max null = open ended. */
  money?: { min: number; max: number | null } | null;
};

/** A shared sector is worth this much. */
const SECTOR_WEIGHT = 2;
/** A founder whose stage the investor backs. Investor and founder pairs only. */
const STAGE_WEIGHT = 2;
/** An investor whose check fits inside the founder's round. Investor and founder pairs only. */
const CHECK_WEIGHT = 2;
/** An investor and a founder are worth meeting whatever they declared. */
const COMPLEMENTARY_BONUS = 3;

/**
 * The sectors someone declared at registration.
 *
 * Investors answer `sectors` (many), founders answer `sector` (one) — and the
 * form has changed over time, so both shapes are accepted from either.
 */
export function sectorsOf(answers: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["sectors", "sector"]) {
    const v = answers[key];
    if (Array.isArray(v)) out.push(...v.map(String));
    else if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

/** The sectors both of them declared. */
export function sharedSectors(a: Matchable, b: Matchable): string[] {
  const mine = new Set(a.sectors);
  return b.sectors.filter((s) => mine.has(s));
}

/**
 * How strong a pair is. Zero means they are not a match at all.
 *
 * Note what this does *not* require: an investor and a founder who declared
 * nothing in common still score, because the room is the point. Two investors
 * only match on a shared sector.
 */
export function pairScore(a: Matchable, b: Matchable): number {
  const shared = sharedSectors(a, b).length;
  let score = shared * SECTOR_WEIGHT + (a.role !== b.role ? COMPLEMENTARY_BONUS : 0);
  // Stage and check size only mean something between an investor and a founder,
  // and only when both declared them. Neither can make a pair match on its own:
  // an investor and founder already match, so these only rank them.
  if (a.role !== b.role) {
    const [inv, fdr] = a.role === "investor" ? [a, b] : [b, a];
    if (stageFits(inv.stages ?? [], fdr.stages ?? [])) score += STAGE_WEIGHT;
    if (checkFits(inv.money ?? null, fdr.money ?? null)) score += CHECK_WEIGHT;
  }
  return score;
}

function stageKey(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

/** The founder's stage is one the investor backs. "Series B+" covers Series B and Growth. */
export function stageFits(investorStages: string[], founderStages: string[]): boolean {
  if (investorStages.length === 0 || founderStages.length === 0) return false;
  const backs = new Set<string>();
  for (const st of investorStages) {
    const k = stageKey(st);
    if (k === "series b+") {
      backs.add("series b");
      backs.add("growth");
    } else backs.add(k);
  }
  return founderStages.some((f) => backs.has(stageKey(f)));
}

/** The investor's smallest check is no larger than the founder's round. */
export function checkFits(
  investor: { min: number; max: number | null } | null,
  round: { min: number; max: number | null } | null,
): boolean {
  if (!investor || !round) return false;
  return round.max === null || investor.min <= round.max;
}

function amount(token: string): number | null {
  const m = token.trim().match(/^\$?\s*([\d.,]+)\s*([kKmMbB])?/);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  return n * (unit === "k" ? 1e3 : unit === "m" ? 1e6 : unit === "b" ? 1e9 : 1);
}

/** "$100k–$500k", "$1M–$3M", "$2M+", "Over $10m" → dollars. Anything else → null. */
export function parseMoneyBand(value: unknown): { min: number; max: number | null } | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  const over = v.match(/^(?:over|more than)\s+(.+)$/i) ?? v.match(/^(.+?)\s*\+$/);
  if (over) {
    const lo = amount(over[1]!);
    return lo === null ? null : { min: lo, max: null };
  }
  const under = v.match(/^(?:under|less than|up to)\s+(.+)$/i);
  if (under) {
    const hi = amount(under[1]!);
    return hi === null ? null : { min: 0, max: hi };
  }
  const parts = v.split(/\s*[–—-]\s*|\s+to\s+/i);
  if (parts.length === 2) {
    const lo = amount(parts[0]!);
    const hi = amount(parts[1]!);
    if (lo !== null && hi !== null && hi >= lo) return { min: lo, max: hi };
  }
  return null;
}

function strings(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return typeof v === "string" && v.trim() ? [v.trim()] : [];
}

/**
 * Everything the rule reads from a registration's answers. Investors answer
 * `stages` (many) and `checkSize`; founders answer `stage` (one) and
 * `roundSize`. Missing answers leave the field out, so the pair scores as before.
 */
export function matchableFromAnswers(role: Matchable["role"], answers: Record<string, unknown>): Matchable {
  const stages = role === "investor" ? strings(answers.stages) : strings(answers.stage);
  const money = parseMoneyBand(role === "investor" ? answers.checkSize : answers.roundSize);
  return {
    role,
    sectors: sectorsOf(answers),
    ...(stages.length ? { stages } : {}),
    ...(money ? { money } : {}),
  };
}

/**
 * How many pairs in this room match.
 *
 * Quadratic, and deliberately so: a 106-person event is ~5,500 comparisons,
 * which is nothing. It is counted rather than stored so that a registration
 * arriving five minutes ago is already in the number.
 */
export function countMatches(people: Matchable[]): number {
  let n = 0;
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      if (pairScore(people[i], people[j]) > 0) n += 1;
    }
  }
  return n;
}
