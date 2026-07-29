import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  extractInvestorPreferences,
  type InvestorExtraField,
  type InvestorPreferences,
} from "./preferences";
import {
  scoreInvestorPreferenceMatch,
  type CompanyMatchInput,
  type PreferenceMatch,
} from "./preference-match";

/**
 * Loads investor contacts from the CRM mirror, normalizes their structured
 * preferences, and (optionally) scores them against a company for the admin
 * "search & match" directory. An investor contact is any CRM contact that has
 * at least one structured preference set. Overrides (local admin edits) win over
 * the Odoo-synced raw values, matching the rest of the contact model.
 */

export type ScoredInvestorContact = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  preferences: InvestorPreferences;
  /** Present only when scored against a company. */
  match: PreferenceMatch | null;
};

/** Read raw.__profile.extra (Odoo questionnaire) into label/value pairs. */
function flattenExtra(raw: Record<string, unknown> | null): InvestorExtraField[] {
  const prof = (raw?.__profile as { extra?: Record<string, unknown> } | undefined) ?? undefined;
  if (!prof?.extra) return [];
  const out: InvestorExtraField[] = [];
  for (const [label, v] of Object.entries(prof.extra)) {
    let values: string[];
    if (Array.isArray(v)) {
      values = v
        .map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x)))
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (v == null || v === "") {
      values = [];
    } else {
      values = [String(v).trim()].filter(Boolean);
    }
    if (values.length) out.push({ label, values });
  }
  return out;
}

const MASKABLE_KEYS = [
  "investmentSize",
  "useOfFunds",
  "dealsPerYear",
  "revenueRange",
  "ebitdaRange",
  "managementTeam",
  "activeRating",
  "contactPreference",
] as const;
type MaskKey = (typeof MASKABLE_KEYS)[number];

function fieldSignature(p: InvestorPreferences, k: MaskKey): string {
  const v = p[k];
  return Array.isArray(v) ? [...v].map((s) => s.toLowerCase()).sort().join("|") : (v ?? "∅").toLowerCase();
}

/**
 * Fields that actually vary across investors carry signal. A field where every
 * investor has the identical value (e.g. all the option bands checked for
 * everyone — a common Odoo import artifact) is non-discriminating and is dropped
 * so it can't inflate every match to 100%.
 */
export function computeInformativeFields(prefs: InvestorPreferences[]): Set<MaskKey> {
  const informative = new Set<MaskKey>();
  if (prefs.length < 2) return new Set(MASKABLE_KEYS); // can't tell — keep all
  for (const k of MASKABLE_KEYS) {
    const sigs = new Set(prefs.map((p) => fieldSignature(p, k)));
    sigs.delete("∅");
    sigs.delete("");
    if (sigs.size > 1) informative.add(k);
  }
  return informative;
}

/** Blank out fields that carry no signal so the scorer ignores them. */
export function maskPreferences(p: InvestorPreferences, informative: Set<MaskKey>): InvestorPreferences {
  return {
    ...p,
    investmentSize: informative.has("investmentSize") ? p.investmentSize : [],
    useOfFunds: informative.has("useOfFunds") ? p.useOfFunds : [],
    dealsPerYear: informative.has("dealsPerYear") ? p.dealsPerYear : null,
    revenueRange: informative.has("revenueRange") ? p.revenueRange : [],
    ebitdaRange: informative.has("ebitdaRange") ? p.ebitdaRange : [],
    managementTeam: informative.has("managementTeam") ? p.managementTeam : [],
    activeRating: informative.has("activeRating") ? p.activeRating : null,
    contactPreference: informative.has("contactPreference") ? p.contactPreference : null,
  };
}

function hasAnyPreference(p: InvestorPreferences): boolean {
  return (
    p.investmentSize.length > 0 ||
    p.useOfFunds.length > 0 ||
    p.revenueRange.length > 0 ||
    p.ebitdaRange.length > 0 ||
    p.managementTeam.length > 0 ||
    p.dealsPerYear != null ||
    p.activeRating != null ||
    p.contactPreference != null
  );
}

/** Load one investor contact's structured preferences (raw + overrides). */
export async function loadContactPreferences(
  contactId: string,
): Promise<{ id: string; name: string; preferences: InvestorPreferences } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const { data: c } = await db
    .from("crm_contacts")
    .select("id, name, email, raw, overrides")
    .eq("id", contactId)
    .maybeSingle();
  if (!c) return null;

  const raw = (c.raw as Record<string, unknown> | null) ?? null;
  const overrides = (c.overrides as Record<string, unknown> | null) ?? null;
  const extra = flattenExtra(raw);
  if (overrides) {
    for (const [label, v] of Object.entries(overrides)) {
      if (v == null) continue;
      const values = (Array.isArray(v) ? v.map((x) => String(x)) : [String(v)]).map((s) => s.trim()).filter(Boolean);
      const idx = extra.findIndex((e) => e.label.trim().toLowerCase() === label.trim().toLowerCase());
      if (idx >= 0) extra[idx] = { label, values };
      else extra.push({ label, values });
    }
  }
  return { id: String(c.id), name: (c.name as string) ?? (c.email as string) ?? "Investor", preferences: extractInvestorPreferences(extra) };
}

/**
 * Load investor contacts (those with structured preferences). When `scoreAgainst`
 * is given, each is scored and the list is sorted by match, highest first.
 */
export async function loadInvestorContacts(opts?: {
  scoreAgainst?: CompanyMatchInput;
  limit?: number;
}): Promise<ScoredInvestorContact[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const limit = opts?.limit ?? 500;

  const { data, error } = await db
    .from("crm_contacts")
    .select("id, name, email, company, raw, overrides")
    .limit(limit);
  if (error || !Array.isArray(data)) return [];

  const rows: ScoredInvestorContact[] = [];
  for (const c of data as Array<Record<string, unknown>>) {
    const raw = (c.raw as Record<string, unknown> | null) ?? null;
    const overrides = (c.overrides as Record<string, unknown> | null) ?? null;

    // Base preferences from the synced questionnaire, then apply any local
    // overrides stored as { "<label>": string[] | string }.
    const extra = flattenExtra(raw);
    if (overrides) {
      for (const [label, v] of Object.entries(overrides)) {
        if (v == null) continue;
        const values = Array.isArray(v) ? v.map((x) => String(x)) : [String(v)];
        const clean = values.map((s) => s.trim()).filter(Boolean);
        const idx = extra.findIndex((e) => e.label.trim().toLowerCase() === label.trim().toLowerCase());
        if (idx >= 0) extra[idx] = { label, values: clean };
        else extra.push({ label, values: clean });
      }
    }

    const preferences = extractInvestorPreferences(extra);
    if (!hasAnyPreference(preferences)) continue;

    rows.push({
      id: String(c.id),
      name: (c.name as string) ?? (c.email as string) ?? "Investor",
      email: (c.email as string) ?? null,
      company: (c.company as string) ?? null,
      preferences,
      match: null,
    });
  }

  // Score only on fields that actually discriminate between investors, so
  // non-discriminating data (everyone identical) doesn't peg every match to 100%.
  if (opts?.scoreAgainst) {
    const informative = computeInformativeFields(rows.map((r) => r.preferences));
    for (const r of rows) {
      r.match = scoreInvestorPreferenceMatch(opts.scoreAgainst, maskPreferences(r.preferences, informative));
    }
    rows.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
  }
  return rows;
}
