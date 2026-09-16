/**
 * "Investor profile" — the contact field that mirrors Odoo's Investor Profile list.
 * Client-safe (no IO). The stored key stays "Investor type" (overrides) /
 * `investorTypes` (profile) so matching, Form D and the marketplace are untouched;
 * only the display name and the option enforcement live here. The SQL twin is
 * `public.investor_profile_canon` (migration 20260916001) — keep the two in step.
 */

export const INVESTOR_PROFILE_LABEL = "Investor profile";
/** The overrides key a manual pick is stored under (historical name). */
export const INVESTOR_PROFILE_OVERRIDE_KEY = "Investor type";

/** Odoo's Investor Profile options, in the order the picker shows them. */
export const INVESTOR_PROFILE_OPTIONS = [
  "Angel Investor", "Venture Capital", "Fund Manager", "Represent Investors", "Private Equity", "Family Office",
  "Banker/Lender", "Investment Bank", "Hedge Fund", "Lender", "Service Provider", "Other",
] as const;

const ALIASES: Record<string, string> = {
  angel: "Angel Investor", angels: "Angel Investor", "angel investor": "Angel Investor", "angel investors": "Angel Investor",
  vc: "Venture Capital", venture: "Venture Capital", "venture capital": "Venture Capital", "venture capitalist": "Venture Capital",
  "fund manager": "Fund Manager", "fund managers": "Fund Manager",
  "represent investors": "Represent Investors", "represents investors": "Represent Investors", "representing investors": "Represent Investors",
  "private equity": "Private Equity", pe: "Private Equity",
  "family office": "Family Office", "family offices": "Family Office",
  "banker/lender": "Banker/Lender", "banker / lender": "Banker/Lender", banker: "Banker/Lender",
  "investment bank": "Investment Bank", "investment banker": "Investment Bank",
  "hedge fund": "Hedge Fund", "hedge funds": "Hedge Fund",
  lender: "Lender",
  "service provider": "Service Provider", "service providers": "Service Provider",
  other: "Other", others: "Other",
};

/** Canonical spelling for one value; unknown values come back trimmed as typed. */
export function canonicalInvestorProfile(v: string): string {
  const t = v.trim();
  return ALIASES[t.toLowerCase()] ?? t;
}

/** Split comma-joined input, canonicalise, drop blanks / Odoo's `false`, dedupe (keeps order). */
export function normalizeInvestorProfiles(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of values) for (const part of raw.split(",")) {
    const c = canonicalInvestorProfile(part);
    if (!c || c.toLowerCase() === "false" || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

export function isListedInvestorProfile(v: string): boolean {
  return (INVESTOR_PROFILE_OPTIONS as readonly string[]).includes(v);
}

/** True for the labels this field has gone by (Odoo answer labels + our old name). */
export function isInvestorProfileLabel(label: string): boolean {
  return /^investor\s*(profile|type)\??$/i.test(label.trim());
}
