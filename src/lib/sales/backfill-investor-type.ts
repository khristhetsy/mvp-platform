/**
 * Decide an investor's Investor Type for the backfill, from two sources:
 *   1. The Odoo "Investor Profile" field (captured under raw.__profile.extra[<label>]).
 *   2. Contacts sourced from SEC Form D → ["Venture Capital", "Fund Manager"].
 * Rule 1 wins when both apply. The grid groups on raw.__profile.investorTypes, so that
 * is where the backfill writes. Pure + unit-tested; the API does the DB scan/write.
 */

export type ProfileLike = { investorTypes?: unknown; leadSource?: unknown; extra?: Record<string, unknown> } | null | undefined;
export type ContactRow = { source?: string | null; overrides?: Record<string, unknown> | null; raw?: { __profile?: ProfileLike } | null };

// The two tags SEC Form D investors get.
export const FORM_D_TYPES = ["Venture Capital", "Fund Manager"] as const;

// An Odoo custom-field label looks like the investor's own profile/type when it
// matches this — used to auto-detect the field without hard-coding its exact name.
export const INVESTOR_PROFILE_LABEL_RE = /investor\s*(profile|type|category|class)|type\s*of\s*investor/i;

/** Split a multi-value string ("Venture Capital, Fund Manager" / "A and B" / "A / B"). */
export function splitMulti(s: string): string[] {
  return s.split(/\s*(?:,|;|\/|\||\band\b)\s*/i).map((x) => x.trim()).filter(Boolean);
}
export function toStrList(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => toStrList(x));
  if (typeof v === "string") return splitMulti(v);
  return [];
}

/** Investor type(s) from the Odoo "Investor Profile" field in extra. `label` forces a
 *  specific extra key; otherwise the first label matching the profile regex is used. */
export function odooInvestorTypes(profile: ProfileLike, label?: string): { types: string[]; label: string | null } {
  const extra = (profile?.extra ?? {}) as Record<string, unknown>;
  if (label && label in extra) {
    const t = toStrList(extra[label]);
    if (t.length) return { types: t, label };
  }
  for (const [k, val] of Object.entries(extra)) {
    if (!INVESTOR_PROFILE_LABEL_RE.test(k)) continue;
    const t = toStrList(val);
    if (t.length) return { types: t, label: k };
  }
  return { types: [], label: null };
}

export function isFormD(row: ContactRow): boolean {
  if ((row.source ?? "").toLowerCase() === "formd") return true;
  const ls = (row.raw?.__profile?.leadSource ?? row.overrides?.lead_source ?? "") as string;
  return /sec\s*form\s*d|form\s*d/i.test(String(ls));
}

export type Decision = { types: string[]; from: "existing" | "odoo" | "formd" | "none"; write: boolean; matchedLabel: string | null };

/**
 * Decide the types to store. `overwrite=false` (default) leaves any existing
 * investorTypes untouched; the Odoo profile wins over the Form D fallback.
 */
export function decideInvestorTypes(row: ContactRow, opts: { overwrite?: boolean; label?: string } = {}): Decision {
  const profile = row.raw?.__profile;
  const current = toStrList(profile?.investorTypes);
  if (current.length && !opts.overwrite) return { types: current, from: "existing", write: false, matchedLabel: null };

  const odoo = odooInvestorTypes(profile, opts.label);
  if (odoo.types.length) return { types: dedupe(odoo.types), from: "odoo", write: true, matchedLabel: odoo.label };

  if (isFormD(row)) return { types: [...FORM_D_TYPES], from: "formd", write: true, matchedLabel: null };

  return { types: current, from: "none", write: false, matchedLabel: null };
}

function dedupe(a: string[]): string[] { return [...new Set(a)]; }
