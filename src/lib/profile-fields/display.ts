/**
 * Per-screen display of profile fields: Shown and Required.
 *
 * Deliberately only these two. The question type (pick one, pick several,
 * typed) is fixed in code, because matching parses the stored values and a
 * switched type would score nothing without any error.
 *
 * Defaults reproduce what each screen did before this setting existed, so an
 * empty configuration changes nothing.
 */

export const DISPLAY_SURFACES = ["founder_onboarding", "founder_settings", "admin_editors"] as const;
export type DisplaySurface = (typeof DISPLAY_SURFACES)[number];

/** Matching config keys (InvestorMatchConfig.requiredFields). */
export type MatchRequiredKey =
  | "industry" | "checkSize" | "revenueStage" | "useOfFunds" | "geography"
  | "activeRating" | "investorType" | "capitalType";

export type DisplayField = {
  /** Company column, also the settings form key. */
  key: string;
  /** Row name on the Where used tab. */
  name: string;
  /** Onboarding step that asks it; absent when onboarding does not. */
  onboardingStep?: number;
  /** Required in onboarding before this setting existed. */
  onboardingRequired: boolean;
  /** Required in founder settings before this setting existed. */
  settingsRequired: boolean;
  /** When matching marks this key required, the field is locked shown and required. */
  lockKey?: MatchRequiredKey;
};

export const DISPLAY_FIELDS: DisplayField[] = [
  { key: "industry", name: "Industry", onboardingStep: 2, onboardingRequired: true, settingsRequired: true, lockKey: "industry" },
  { key: "revenue_stage", name: "Revenue stage", onboardingStep: 3, onboardingRequired: true, settingsRequired: false, lockKey: "revenueStage" },
  { key: "funding_amount_band", name: "Amount of capital", onboardingStep: 4, onboardingRequired: true, settingsRequired: false, lockKey: "checkSize" },
  { key: "use_of_funds", name: "Use of funds", onboardingStep: 6, onboardingRequired: false, settingsRequired: false, lockKey: "useOfFunds" },
  { key: "seeking_investor_types", name: "Investor type", onboardingStep: 7, onboardingRequired: true, settingsRequired: false, lockKey: "investorType" },
  { key: "seeking_capital_types", name: "Capital type", onboardingStep: 7, onboardingRequired: true, settingsRequired: false, lockKey: "capitalType" },
  { key: "business_entity", name: "Business entity", onboardingStep: 7, onboardingRequired: true, settingsRequired: false },
  { key: "funding_stage", name: "Funding stage", onboardingStep: 7, onboardingRequired: true, settingsRequired: false },
  { key: "operating_stage", name: "Operating stage", onboardingStep: 7, onboardingRequired: true, settingsRequired: false },
  { key: "annual_ebitda", name: "Annual EBITDA", onboardingStep: 7, onboardingRequired: true, settingsRequired: false },
  { key: "annual_revenue_size", name: "Annual revenue size", onboardingStep: 8, onboardingRequired: false, settingsRequired: false },
  { key: "arr", name: "ARR", onboardingStep: 8, onboardingRequired: false, settingsRequired: false },
  { key: "mrr", name: "MRR", onboardingStep: 8, onboardingRequired: false, settingsRequired: false },
];

/** Onboarding steps whose only question is one of the fields above. */
export const SKIPPABLE_STEPS: Record<number, string> = { 3: "revenue_stage", 4: "funding_amount_band" };

export type DisplaySetting = { shown?: boolean; required?: boolean };
/** What is stored: overrides only, by surface then field key. */
export type DisplayConfig = Partial<Record<DisplaySurface, Record<string, DisplaySetting>>>;

export type ResolvedField = { shown: boolean; required: boolean; locked: boolean; lockReason?: string };
export type ResolvedSurface = Record<string, ResolvedField>;

export function fieldByKey(key: string): DisplayField | undefined {
  return DISPLAY_FIELDS.find((f) => f.key === key);
}

export function fieldByName(name: string): DisplayField | undefined {
  return DISPLAY_FIELDS.find((f) => f.name === name);
}

/** Whether a surface can show this field at all. */
export function appliesTo(field: DisplayField, surface: DisplaySurface): boolean {
  return surface !== "founder_onboarding" || field.onboardingStep !== undefined;
}

/**
 * The effective setting for every field on a surface.
 *
 * Locks come from the matching settings, not from this page: a field matching
 * requires is always shown and required. Admin editors never enforce Required,
 * so staff are never blocked.
 */
export function resolveSurface(
  config: DisplayConfig,
  surface: DisplaySurface,
  matchRequired: Partial<Record<MatchRequiredKey, boolean>>,
): ResolvedSurface {
  const out: ResolvedSurface = {};
  const overrides = config[surface] ?? {};
  for (const f of DISPLAY_FIELDS) {
    if (!appliesTo(f, surface)) continue;
    const base = surface === "founder_onboarding" ? f.onboardingRequired : surface === "founder_settings" ? f.settingsRequired : false;
    const locked = Boolean(f.lockKey && matchRequired[f.lockKey]) && surface !== "admin_editors";
    const o = overrides[f.key] ?? {};
    const shown = locked ? true : o.shown ?? true;
    const required = surface === "admin_editors" ? false : locked ? true : shown && (o.required ?? base);
    out[f.key] = locked
      ? { shown, required, locked, lockReason: "Matching requires it (Admin, Matching settings)." }
      : { shown, required, locked };
  }
  return out;
}

/** Everything shown with the original requirements: what a screen does with no configuration. */
export function defaultSurface(surface: DisplaySurface): ResolvedSurface {
  return resolveSurface({}, surface, {});
}

export type DisplayChange = { surface: DisplaySurface; key: string; shown: boolean; required: boolean };
export type DisplayCheck = { ok: true } | { ok: false; reason: string };

export function checkDisplayChange(change: DisplayChange, matchRequired: Partial<Record<MatchRequiredKey, boolean>>): DisplayCheck {
  const f = fieldByKey(change.key);
  if (!f) return { ok: false, reason: "That field is not managed here." };
  if (!appliesTo(f, change.surface)) return { ok: false, reason: "That screen does not ask this field." };
  if (change.surface !== "admin_editors" && f.lockKey && matchRequired[f.lockKey] && (!change.shown || !change.required)) {
    return { ok: false, reason: `${f.name} is required by the matching settings, so it stays shown and required.` };
  }
  if (change.surface === "admin_editors" && change.required) return { ok: false, reason: "Staff screens never require a field." };
  if (!change.shown && change.required) return { ok: false, reason: "A hidden field cannot be required." };
  return { ok: true };
}

/** Store only what differs from the default, so an unchanged field keeps following it. */
export function applyDisplayChange(config: DisplayConfig, change: DisplayChange): DisplayConfig {
  const f = fieldByKey(change.key)!;
  const base = change.surface === "founder_onboarding" ? f.onboardingRequired : change.surface === "founder_settings" ? f.settingsRequired : false;
  const surface = { ...(config[change.surface] ?? {}) };
  const entry: DisplaySetting = {};
  if (!change.shown) entry.shown = false;
  if (change.surface !== "admin_editors" && change.shown && change.required !== base) entry.required = change.required;
  if (Object.keys(entry).length) surface[change.key] = entry;
  else delete surface[change.key];
  return { ...config, [change.surface]: surface };
}
