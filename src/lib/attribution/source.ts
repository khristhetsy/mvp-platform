/**
 * Which signal wins when several claim the same booking.
 *
 * A meeting can arrive with up to five hints about where it came from, and they
 * are not equally trustworthy: a completed /fit funnel is evidence, an answer to
 * "how did you hear about us?" is a recollection. This module is the one place
 * that ranks them, so the scheduler, the book route and the staff override all
 * agree rather than each having an opinion.
 *
 * The ladder, first match wins:
 *
 *   1. fit           the person walked the funnel — ALWAYS wins
 *   2. link          clicked a tagged scheduler link
 *   3. cookie        arrived from a tagged link earlier in the window
 *   4. self_reported told us in the booking form
 *   5. manual        a staff member set it afterwards — overrides everything
 *
 * Ranks 1–4 are first-touch: once a booking has a source it is not replaced by
 * a later signal. That matches what `/fit` already does
 * (`if (!overrides.lead_source)`), so the platform keeps one rule rather than
 * two. Rank 5 is the deliberate exception — a person overriding a machine.
 *
 * Pure. No Supabase, no fetch.
 */

export const SOURCE_CONFIDENCES = [
  "fit",
  "link",
  "cookie",
  "self_reported",
  "manual",
] as const;

export type SourceConfidence = (typeof SOURCE_CONFIDENCES)[number];

export type AttributedSource = {
  tag: string;
  confidence: SourceConfidence;
};

/**
 * Lower number = more trusted. `manual` sits at the top because a human who sat
 * in the meeting knows more than any cookie, but it is applied separately (see
 * `applyManualSource`) rather than competing in the automatic resolve.
 */
const RANK: Record<SourceConfidence, number> = {
  manual: 0,
  fit: 1,
  link: 2,
  cookie: 3,
  self_reported: 4,
};

export function sourceRank(confidence: SourceConfidence): number {
  return RANK[confidence];
}

export function isSourceConfidence(value: string): value is SourceConfidence {
  return (SOURCE_CONFIDENCES as readonly string[]).includes(value);
}

export const SOURCE_CONFIDENCE_LABEL: Record<SourceConfidence, string> = {
  fit: "Completed the fit funnel",
  link: "Clicked a tagged link",
  cookie: "Arrived from a tagged link",
  self_reported: "Told us in the booking form",
  manual: "Set by staff",
};

/** Self-reported is a recollection, not evidence — the UI marks it. */
export function isHighConfidence(confidence: SourceConfidence): boolean {
  return confidence === "fit" || confidence === "link" || confidence === "cookie";
}

/**
 * Campaign tags are slugs. A tag arriving from a URL may carry stray case,
 * whitespace or a trailing slash, and `"LinkedIn"` must never be treated as
 * the same thing as the slug `linkedin-sept` — this only tidies, it does not
 * guess.
 */
export function normalizeSourceTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
    .slice(0, 120);
  if (!cleaned) return null;
  // A tag has to look like a slug. Free text ("a friend", "google search")
  // is a legitimate answer to the form question but is not a campaign, and
  // letting it through is exactly the bug that made lead_source useless.
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(cleaned)) return null;
  return cleaned;
}

export type SourceCandidates = {
  /** From the /fit funnel handoff. Highest confidence, always wins. */
  fitTag?: string | null;
  /** From `?src=` on the scheduler link. */
  linkTag?: string | null;
  /** From the site-wide first-touch cookie. */
  cookieTag?: string | null;
  /** From the booking form's campaign-mapped picklist. */
  selfReportedTag?: string | null;
};

/**
 * Pick the winner from whatever this booking arrived with.
 *
 * Returns null when nothing usable was captured — which is a real outcome, not
 * a failure: the booking is recorded as unattributed and shown as such.
 */
export function resolveSource(candidates: SourceCandidates): AttributedSource | null {
  const ordered: Array<[SourceConfidence, string | null | undefined]> = [
    ["fit", candidates.fitTag],
    ["link", candidates.linkTag],
    ["cookie", candidates.cookieTag],
    ["self_reported", candidates.selfReportedTag],
  ];

  for (const [confidence, raw] of ordered) {
    const tag = normalizeSourceTag(raw);
    if (tag) return { tag, confidence };
  }
  return null;
}

/**
 * Whether a newly resolved source may replace what the booking already has.
 *
 * First-touch: an existing source stands. The one exception is `manual`, which
 * is a staff member deliberately correcting the record.
 */
export function shouldReplaceSource(
  existing: AttributedSource | null,
  incoming: AttributedSource,
): boolean {
  if (!existing) return true;
  if (incoming.confidence === "manual") return true;
  return false;
}

/** The staff override. Always wins, and the caller records who and when. */
export function applyManualSource(tag: string): AttributedSource | null {
  const normalized = normalizeSourceTag(tag);
  return normalized ? { tag: normalized, confidence: "manual" } : null;
}

// ── capture from a URL ──────────────────────────────────────────────────────

/** Query keys that carry a campaign tag, in the order they are trusted. */
export const SOURCE_QUERY_KEYS = ["src", "utm_campaign", "utm_source"] as const;

/**
 * Read a campaign tag off a URL's query string.
 *
 * `src` is ours and wins. `utm_campaign` beats `utm_source` because a campaign
 * is more specific than a channel — "linkedin" alone cannot tell two LinkedIn
 * campaigns apart.
 */
export function sourceTagFromQuery(params: URLSearchParams): string | null {
  for (const key of SOURCE_QUERY_KEYS) {
    const tag = normalizeSourceTag(params.get(key));
    if (tag) return tag;
  }
  return null;
}

/** Cookie the site-wide capture writes. Distinct from /fit's `fs_session`. */
export const SOURCE_COOKIE = "icapos_src";

/** How long a first touch stays creditable. */
export const SOURCE_COOKIE_MAX_AGE_DAYS = 90;
