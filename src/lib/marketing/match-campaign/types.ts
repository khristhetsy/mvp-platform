/**
 * Match campaigns: a Marketing Hub campaign type that emails founder leads their
 * current investor matches: names shown, contact details hidden. No email goes to investors.
 * Shared types; everything here is client safe.
 */

export type FounderType = "lead" | "existing_user" | "in_pipeline";

/** Most founders one Match campaign can take (Select all on the founder list step). */
export const MAX_CAMPAIGN_FOUNDERS = 25000;

export type ExcludedReason =
  | "missing_industry"
  | "missing_stage"
  | "unconfirmed_data"
  | "no_email"
  | "invalid_email"
  | "email_unverified"
  | "suppressed"
  | "eu_excluded"
  | "emailed_recently"
  | "no_matches";

export type MatchFlow = "plan" | "review";

export type SendStatus = "pending" | "sent" | "failed" | "skipped" | "dry_run";

/** marketing_campaigns.match_config. Non-null marks the campaign as type Match. */
export type MatchConfig = {
  /** Saved marketing list the founders came from, when picked from a list. */
  founder_list_id?: string | null;
  /** Emails per day; the rest wait for the next cron pass. */
  daily_cap: number;
  /** Matches previewed in the email. */
  preview_count: number;
  /** Only send to founders whose email_status is "valid". */
  verified_only: boolean;
  /**
   * Also accept industry inferred with low confidence ("inferred:low") and stages
   * set by a default guess ("guess:default"). Off: those founders are held back.
   */
  include_inferred: boolean;
  /** An investor counts as a match only at or above this engine score (0 to 100). */
  min_score: number;
  /** Exclude EU, EEA, UK and Swiss leads (GDPR and equivalents). */
  exclude_eu: boolean;
  /** Record sends without dispatching any email (demo and test runs). */
  dry_run: boolean;
  /**
   * Hold back founders who got a real email (Day 0 or follow up) from another
   * Match campaign within cooldown_days. Checked in the data check and again
   * right before each send. Test mode sends never count.
   */
  cooldown_enabled: boolean;
  /** Days a founder rests between Match campaigns (1 to 365). */
  cooldown_days: number;
  /**
   * Rematch founders not yet emailed every day at 23:30 UTC (before the next
   * day's sends), so they get new and hidden investors picked up. Off by default.
   */
  daily_rematch: boolean;
  /** When the daily rematch last finished for this campaign (ISO), for the editor. */
  last_rematch_at: string | null;
  /** "Schedule a call with us" target. */
  call_url: string;
  /**
   * Email and match page layout. "plan": the original layout (Schedule a call
   * and Choose a plan side by side, match % shown). "review": the match review
   * flow, where the primary action is booking a free 15 minute match review and
   * the plan is secondary. Campaigns created before this setting read as "plan",
   * so live campaigns keep their layout; new campaigns start on "review".
   */
  flow: MatchFlow;
  /** Review flow: matches open by name on the founder pages; the rest show as locked. */
  visible_count: number;
  /** Engine weights at the time matching ran (snapshot, for the record). */
  weights?: Record<string, number> | null;
  /** Campaign cost inputs for ROI, entered by admin on Results. */
  cost?: { send_cost_usd?: number | null; admin_hours?: number | null; hourly_rate_usd?: number | null } | null;
  /**
   * Follow up sequence (needs MATCH_SEQUENCE_ENABLED=true). Off: the campaign
   * sends exactly as before, one email, no follow ups.
   */
  sequence_enabled: boolean;
  /** Most founders per cohort (industry, stage, region); bigger cohorts split into parts. */
  cohort_cap: number;
  /** Percent of each cohort held back to the single Day 0 email, for the split test. 0 turns the test off. */
  holdout_pct: number;
  /** Cohorts the admin left out of this campaign. */
  excluded_cohorts: string[];
};

/**
 * One investor as shown to a founder before payment: name and firm, never
 * contact details (email, phone, LinkedIn). Contact details and Request
 * introduction unlock with a plan.
 */
export type MaskedMatch = {
  /** Display name; null on snapshots taken before names were shown. */
  investor_name?: string | null;
  /** Firm, only when it differs from the name (angels often list their own name). */
  investor_firm?: string | null;
  investor_type: string | null;
  sectors: string[];
  /** The investor's sectors that produced the fit; shown as "Matched on". Absent on older snapshots. */
  matched_sectors?: string[];
  stages: string[];
  check_band: string | null;
  match_score: number;
};

/** Row of the match_campaign_founder_fields view. */
export type FounderFieldsRow = {
  id: string;
  name: string | null;
  email: string | null;
  email_status: string | null;
  /** "profile" = pattern-guessed address (see lib/marketing/sendable.ts). */
  email_source?: string | null;
  suppressed: boolean | null;
  company: string | null;
  country: string | null;
  industries: string[] | null;
  funding_stages: string[] | null;
  seeking_amount: string[] | null;
  seeking_investor_types: string[] | null;
  supabase_profile_id: string | null;
  pipeline_stage: string | null;
  founder_type: FounderType;
  /** Where an override value came from, e.g. "inferred:high", "guess:default", "crm:extra". */
  industry_source?: string | null;
  stage_source?: string | null;
};

export const EXCLUDED_LABEL: Record<ExcludedReason, string> = {
  missing_industry: "Missing industry",
  missing_stage: "Missing stage",
  unconfirmed_data: "Industry or stage only guessed",
  no_email: "No email",
  invalid_email: "Invalid email",
  email_unverified: "Email unverified",
  suppressed: "Unsubscribed or suppressed",
  eu_excluded: "EU lead, excluded",
  emailed_recently: "Emailed recently",
  no_matches: "No matches",
};

export const FOUNDER_TYPE_LABEL: Record<FounderType, string> = {
  lead: "Lead only",
  existing_user: "Existing user",
  in_pipeline: "In pipeline",
};

/** The /fit structuring call host, the same link /fit's "Book a structuring call" uses. */
export const DEFAULT_CALL_PATH = "/schedule/dc2f3667-ca80-4f35-a1cd-ba0c3adac510";

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  founder_list_id: null,
  daily_cap: 150,
  preview_count: 3,
  verified_only: true,
  include_inferred: false,
  min_score: 70,
  exclude_eu: true,
  dry_run: true,
  call_url: DEFAULT_CALL_PATH,
  cooldown_enabled: true,
  cooldown_days: 30,
  daily_rematch: false,
  last_rematch_at: null,
  flow: "review",
  visible_count: 3,
  weights: null,
  cost: null,
  sequence_enabled: false,
  cohort_cap: 50,
  holdout_pct: 50,
  excluded_cohorts: [],
};

export function isMatchCampaign(c: { match_config?: unknown } | null | undefined): boolean {
  return Boolean(c && c.match_config && typeof c.match_config === "object");
}

export function readMatchConfig(raw: unknown): MatchConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MatchConfig>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : d);
  return {
    founder_list_id: typeof r.founder_list_id === "string" ? r.founder_list_id : null,
    daily_cap: num(r.daily_cap, DEFAULT_MATCH_CONFIG.daily_cap),
    preview_count: num(r.preview_count, DEFAULT_MATCH_CONFIG.preview_count),
    verified_only: typeof r.verified_only === "boolean" ? r.verified_only : DEFAULT_MATCH_CONFIG.verified_only,
    min_score: typeof r.min_score === "number" && Number.isFinite(r.min_score) ? Math.min(100, Math.max(0, Math.round(r.min_score))) : DEFAULT_MATCH_CONFIG.min_score,
    include_inferred: typeof r.include_inferred === "boolean" ? r.include_inferred : DEFAULT_MATCH_CONFIG.include_inferred,
    exclude_eu: typeof r.exclude_eu === "boolean" ? r.exclude_eu : DEFAULT_MATCH_CONFIG.exclude_eu,
    dry_run: typeof r.dry_run === "boolean" ? r.dry_run : DEFAULT_MATCH_CONFIG.dry_run,
    call_url: typeof r.call_url === "string" && r.call_url.trim() ? r.call_url.trim() : DEFAULT_MATCH_CONFIG.call_url,
    // Missing on campaigns from before the cooldown: on, so no founder is emailed twice in a short window.
    cooldown_enabled: typeof r.cooldown_enabled === "boolean" ? r.cooldown_enabled : DEFAULT_MATCH_CONFIG.cooldown_enabled,
    cooldown_days:
      typeof r.cooldown_days === "number" && Number.isFinite(r.cooldown_days)
        ? Math.min(365, Math.max(1, Math.round(r.cooldown_days)))
        : DEFAULT_MATCH_CONFIG.cooldown_days,
    daily_rematch: typeof r.daily_rematch === "boolean" ? r.daily_rematch : DEFAULT_MATCH_CONFIG.daily_rematch,
    last_rematch_at: typeof r.last_rematch_at === "string" ? r.last_rematch_at : null,
    // Missing means a campaign from before the review flow: keep its layout.
    flow: r.flow === "review" ? "review" : "plan",
    visible_count: num(r.visible_count, DEFAULT_MATCH_CONFIG.visible_count),
    weights: r.weights ?? null,
    cost: r.cost ?? null,
    sequence_enabled: typeof r.sequence_enabled === "boolean" ? r.sequence_enabled : DEFAULT_MATCH_CONFIG.sequence_enabled,
    cohort_cap:
      typeof r.cohort_cap === "number" && Number.isFinite(r.cohort_cap) ? Math.min(100, Math.max(10, Math.round(r.cohort_cap))) : DEFAULT_MATCH_CONFIG.cohort_cap,
    holdout_pct:
      typeof r.holdout_pct === "number" && Number.isFinite(r.holdout_pct) ? Math.min(90, Math.max(0, Math.round(r.holdout_pct))) : DEFAULT_MATCH_CONFIG.holdout_pct,
    excluded_cohorts: Array.isArray(r.excluded_cohorts) ? r.excluded_cohorts.filter((x): x is string => typeof x === "string") : [],
  };
}
