/**
 * iCapOS founder results: testimonials from founders who raised their Capital
 * Readiness Rating on the platform. Separate from home.testimonials, which quotes
 * iCFO advisory clients from before the platform existed.
 *
 * Rules for adding an entry (FTC endorsement guidance, 16 CFR Part 255 and the
 * fake reviews rule, 16 CFR Part 465):
 *   - quote is the founder's own words, trimmed only for length, never added to
 *   - approvedOn is the date the founder agreed to publication (their reply)
 *   - crrStart / crrCurrent come from company_readiness_scores; omit them if the
 *     founder did not want the score shown
 *   - anonymous: true hides name, title and photo
 *
 * The section stays hidden until at least MIN_FOUNDER_RESULTS entries qualify.
 */

export type FounderResult = {
  quote: string;
  approvedOn: string;
  anonymous?: boolean;
  name?: string;
  title?: string;
  company?: string;
  photoUrl?: string;
  industry?: string;
  stage?: string;
  timeOnPlatform?: string;
  crrStart?: number;
  crrCurrent?: number;
};

export const MIN_FOUNDER_RESULTS = 3;

export const founderResultsCopy = {
  eyebrow: "Founder results",
  title: "Founders who got capital ready",
  intro: "Real Capital Readiness Rating results from founders building on iCapOS",
  cta: { label: "Get your Capital Readiness Rating", href: "/start" },
  disclaimer:
    "Testimonials reflect individual founder experiences on the iCapOS platform. Results vary. iCapOS is a software platform and does not raise capital or guarantee funding.",
};

export const founderResults: FounderResult[] = [];

function qualifies(r: FounderResult): boolean {
  if (!r.quote?.trim() || !r.approvedOn?.trim()) return false;
  if (!r.anonymous && !r.name?.trim()) return false;
  return true;
}

/** Entries ready to publish, or an empty list while fewer than the minimum qualify. */
export function visibleFounderResults(list: FounderResult[] = founderResults): FounderResult[] {
  const ready = list.filter(qualifies);
  return ready.length >= MIN_FOUNDER_RESULTS ? ready : [];
}

/** The score badge shows only a real, rising pair of scores. */
export function crrBadge(r: FounderResult): string | null {
  const { crrStart, crrCurrent } = r;
  if (typeof crrStart !== "number" || typeof crrCurrent !== "number") return null;
  if (!Number.isFinite(crrStart) || !Number.isFinite(crrCurrent) || crrCurrent <= crrStart) return null;
  return `CRR ${Math.round(crrStart)} → ${Math.round(crrCurrent)}`;
}

export function initials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "F";
}
