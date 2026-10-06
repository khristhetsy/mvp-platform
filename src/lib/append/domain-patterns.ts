// Contact finder — learned email format per company domain (spec 5.2).
// Learns which format a company uses (first.last, flast …) from emails iCFO
// already has, so a guess for a new person at that company uses the company's
// real format instead of a generic default. Source of truth for "known" emails:
// addresses that were given to us or found on the company's own site under the
// person's name. Pattern guesses ("profile") never count, or the system would
// learn from its own guesses.

import { EMAIL_FORMATS, emailCandidates, domainFromEmail, type EmailFormat } from "./pattern";
import { isRoleAddress } from "@/lib/verify/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** A domain counts as learned at this many matching emails, with no conflicts. */
export const LEARNED_MIN_SAMPLES = 2;
/** Below this many learned domains, the global ranking keeps the default order. */
export const GLOBAL_RANK_MIN_DOMAINS = 20;
/** email_source values whose addresses are real (not our own guesses). */
export const KNOWN_EMAIL_SOURCES = ["given", "site", "provider"] as const;

export type FormatCounts = Partial<Record<EmailFormat, number>>;

export interface DomainPattern {
  domain: string;
  pattern: EmailFormat;
  format_counts: FormatCounts;
  verified_samples: number;
  conflicting_samples: number;
  catch_all: boolean | null;
  last_checked_at: string;
}

/** Which format a known address uses for this person, or null if none fits. */
export function detectFormat(email: string, name: string | null): EmailFormat | null {
  const e = (email ?? "").trim().toLowerCase();
  const local = e.split("@")[0];
  if (!local || !name || isRoleAddress(e)) return null;
  const hit = emailCandidates(name, "x.invalid").find((c) => c.email.split("@")[0] === local);
  return hit?.format ?? null;
}

/** Most common format, its count, and how many known emails use another format. */
export function summarize(counts: FormatCounts): { pattern: EmailFormat; verified: number; conflicting: number } | null {
  let best: EmailFormat | null = null;
  let bestN = 0;
  let total = 0;
  for (const f of EMAIL_FORMATS) {
    const n = counts[f] ?? 0;
    total += n;
    if (n > bestN) { best = f; bestN = n; }
  }
  if (!best) return null;
  return { pattern: best, verified: bestN, conflicting: total - bestN };
}

export function isLearned(p: Pick<DomainPattern, "verified_samples" | "conflicting_samples">): boolean {
  return p.verified_samples >= LEARNED_MIN_SAMPLES && p.conflicting_samples === 0;
}

/** Fold one known email into a domain's counts (pure). */
export function addSample(counts: FormatCounts, format: EmailFormat): FormatCounts {
  return { ...counts, [format]: (counts[format] ?? 0) + 1 };
}

function rowFor(domain: string, counts: FormatCounts) {
  const s = summarize(counts);
  if (!s) return null;
  return {
    domain,
    pattern: s.pattern,
    format_counts: counts,
    verified_samples: s.verified,
    conflicting_samples: s.conflicting,
    last_checked_at: new Date().toISOString(),
  };
}

export interface BackfillResult { scanned: number; matched: number; domains: number; learned: number }

/**
 * Rebuild email_domain_patterns from every known email in crm_contacts.
 * Recomputes from scratch, so it is safe to run again.
 */
export async function learnFromKnownEmails(db: Db, pageSize = 1000): Promise<BackfillResult> {
  const byDomain = new Map<string, FormatCounts>();
  let scanned = 0;
  let matched = 0;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("crm_contacts")
      .select("id, name, email, email_source, email_status")
      .not("email", "is", null)
      .not("name", "is", null)
      .neq("email_status", "invalid")
      .or(`email_source.is.null,email_source.in.(${KNOWN_EMAIL_SOURCES.join(",")})`)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not read contacts: ${error.message}`);
    const rows = (data ?? []) as Array<{ name: string | null; email: string | null }>;
    for (const r of rows) {
      scanned++;
      const domain = domainFromEmail(r.email);
      if (!domain || !r.email) continue;
      const f = detectFormat(r.email, r.name);
      if (!f) continue;
      matched++;
      byDomain.set(domain, addSample(byDomain.get(domain) ?? {}, f));
    }
    if (rows.length < pageSize) break;
  }

  const upserts = [...byDomain.entries()].map(([d, c]) => rowFor(d, c)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await db.from("email_domain_patterns").upsert(upserts.slice(i, i + 500), { onConflict: "domain" });
    if (error) throw new Error(`Could not save patterns: ${error.message}`);
  }
  const learned = upserts.filter((u) => isLearned({ verified_samples: u.verified_samples, conflicting_samples: u.conflicting_samples })).length;
  return { scanned, matched, domains: upserts.length, learned };
}

/** Fold one newly known email (given, or accepted from the company site) into its domain. Best effort. */
export async function recordKnownEmail(db: Db, email: string, name: string | null): Promise<void> {
  try {
    const domain = domainFromEmail(email);
    const f = domain ? detectFormat(email, name) : null;
    if (!domain || !f) return;
    const { data } = await db.from("email_domain_patterns").select("format_counts").eq("domain", domain).maybeSingle();
    const counts = addSample(((data?.format_counts ?? {}) as FormatCounts), f);
    const row = rowFor(domain, counts);
    if (row) await db.from("email_domain_patterns").upsert(row, { onConflict: "domain" });
  } catch {
    // Learning is an optimisation; never block an accept on it.
  }
}

/** Global format ranking across learned domains (cached for 10 minutes per process). */
let rankCache: { at: number; order: EmailFormat[] } | null = null;
export function _clearRankCache(): void { rankCache = null; }

export function rankFromPatterns(rows: Array<Pick<DomainPattern, "pattern" | "verified_samples" | "conflicting_samples">>): EmailFormat[] {
  const learned = rows.filter(isLearned);
  if (learned.length < GLOBAL_RANK_MIN_DOMAINS) return [...EMAIL_FORMATS];
  const freq = new Map<EmailFormat, number>();
  for (const r of learned) freq.set(r.pattern, (freq.get(r.pattern) ?? 0) + 1);
  // Stable: ties keep the default order.
  return [...EMAIL_FORMATS].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
}

async function globalOrder(db: Db): Promise<EmailFormat[]> {
  if (rankCache && Date.now() - rankCache.at < 10 * 60_000) return rankCache.order;
  try {
    const { data } = await db.from("email_domain_patterns").select("pattern, verified_samples, conflicting_samples").gte("verified_samples", LEARNED_MIN_SAMPLES).eq("conflicting_samples", 0).limit(5000);
    const order = rankFromPatterns((data ?? []) as DomainPattern[]);
    rankCache = { at: Date.now(), order };
    return order;
  } catch {
    return [...EMAIL_FORMATS];
  }
}

/**
 * Format order to try for this domain: the domain's learned format first (when
 * learned), then the global ranking. `learned` says which case applied.
 */
export async function formatOrderFor(db: Db, domain: string): Promise<{ order: EmailFormat[]; learned: DomainPattern | null }> {
  const base = await globalOrder(db);
  try {
    const { data } = await db.from("email_domain_patterns").select("domain, pattern, format_counts, verified_samples, conflicting_samples, catch_all, last_checked_at").eq("domain", domain).maybeSingle();
    const p = (data ?? null) as DomainPattern | null;
    if (p && isLearned(p) && (EMAIL_FORMATS as readonly string[]).includes(p.pattern)) {
      return { order: [p.pattern, ...base.filter((f) => f !== p.pattern)], learned: p };
    }
  } catch { /* fall through to the global order */ }
  return { order: base, learned: null };
}
