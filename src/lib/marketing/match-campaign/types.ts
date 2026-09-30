/**
 * Match campaigns: a Marketing Hub campaign type that emails founder leads their
 * current investor matches with investor names hidden. No email goes to investors.
 * Shared types; everything here is client safe.
 */

export type FounderType = "lead" | "existing_user" | "in_pipeline";

export type ExcludedReason =
  | "missing_industry"
  | "missing_stage"
  | "no_email"
  | "invalid_email"
  | "email_unverified"
  | "suppressed"
  | "eu_excluded"
  | "no_matches";

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
  /** Exclude EU, EEA, UK and Swiss leads (GDPR and equivalents). */
  exclude_eu: boolean;
  /** Record sends without dispatching any email (demo and test runs). */
  dry_run: boolean;
  /** "Schedule a call with us" target. */
  call_url: string;
  /** Engine weights at the time matching ran (snapshot, for the record). */
  weights?: Record<string, number> | null;
  /** Campaign cost inputs for ROI, entered by admin on Results. */
  cost?: { send_cost_usd?: number | null; admin_hours?: number | null; hourly_rate_usd?: number | null } | null;
};

/** One investor as shown to a founder before payment: no identity. */
export type MaskedMatch = {
  investor_type: string | null;
  sectors: string[];
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
};

export const EXCLUDED_LABEL: Record<ExcludedReason, string> = {
  missing_industry: "Missing industry",
  missing_stage: "Missing stage",
  no_email: "No email",
  invalid_email: "Invalid email",
  email_unverified: "Email unverified",
  suppressed: "Unsubscribed or suppressed",
  eu_excluded: "EU lead, excluded",
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
  exclude_eu: true,
  dry_run: true,
  call_url: DEFAULT_CALL_PATH,
  weights: null,
  cost: null,
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
    exclude_eu: typeof r.exclude_eu === "boolean" ? r.exclude_eu : DEFAULT_MATCH_CONFIG.exclude_eu,
    dry_run: typeof r.dry_run === "boolean" ? r.dry_run : DEFAULT_MATCH_CONFIG.dry_run,
    call_url: typeof r.call_url === "string" && r.call_url.trim() ? r.call_url.trim() : DEFAULT_MATCH_CONFIG.call_url,
    weights: r.weights ?? null,
    cost: r.cost ?? null,
  };
}
