// Single source of truth for the company Industry picker.
//
// Derived from the existing shared sector taxonomy (EVENT_SECTORS) so the
// founder profile, the admin company-basics editor, investor matching, the
// marketplace card, and event tracks all speak the same vocabulary.
//
// We store the canonical LABEL (e.g. "CleanTech") in companies.industry — every
// existing consumer already reads that column as a display string, so no data
// migration is required. Legacy free-text values (e.g. "Agtech") are preserved
// and surfaced as a selectable option until someone re-picks from the list.

import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";

/** Canonical industry labels, in taxonomy order. */
export const INDUSTRY_OPTIONS: readonly string[] = EVENT_SECTORS.map((s) => s.label);

/** Is this value one of the canonical industries? */
export function isCanonicalIndustry(value: string | null | undefined): boolean {
  if (!value) return false;
  return INDUSTRY_OPTIONS.some((label) => label.toLowerCase() === value.trim().toLowerCase());
}

/**
 * Options to render in a picker for a given current value: the canonical list,
 * with any non-canonical legacy value prepended so it stays visible and is never
 * silently rewritten.
 */
export function industryOptionsFor(current: string | null | undefined): string[] {
  const value = (current ?? "").trim();
  if (value && !isCanonicalIndustry(value)) return [value, ...INDUSTRY_OPTIONS];
  return [...INDUSTRY_OPTIONS];
}
