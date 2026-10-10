/** Investor directory: public investor data, not the iCFO Capital investor network. */

export type DirectoryVerification = "unverified" | "needs_input" | "verified" | "bounced" | "opt_out";
export type DirectoryStatus = "draft" | "published" | "suppressed";
export type AccessStatus = "active" | "paused" | "suspended";

export type DirectoryRecord = {
  id: string;
  firm: string;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  country: string;
  investor_types: string[];
  funding_stages: string[];
  capital_types: string[];
  industries: string[];
  fund_name: string | null;
  fund_size: number | null;
  avg_investment: number | null;
  strategy: string | null;
  investing_now: boolean | null;
  source: string;
  source_url: string | null;
  import_id: string | null;
  status: DirectoryStatus;
  verification: DirectoryVerification;
  verified_at: string | null;
  opted_out_at: string | null;
  in_network: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A top up on top of the founder's plan. hold_limit is the contact space it
 * adds and email_limit the Manual outreach emails per 30 days it adds.
 */
export type DirectoryTier = {
  key: string;
  label: string;
  hold_limit: number;
  email_limit: number;
  show_email: boolean;
  can_export: boolean;
  price_cents: number | null;
  sort: number;
};

export type DirectorySettings = {
  block_over_limit: boolean;
  daily_cap: number;
  spike_imports: number;
  spike_hours: number;
  auto_pause_on_bounce: boolean;
  bounce_pause_pct: number;
  bounce_min_sends: number;
  require_terms: boolean;
  honor_opt_outs: boolean;
  allow_export: boolean;
  stale_days: number;
  terms_version: number;
};

export const DEFAULT_SETTINGS: DirectorySettings = {
  block_over_limit: true,
  daily_cap: 500,
  spike_imports: 1000,
  spike_hours: 48,
  auto_pause_on_bounce: true,
  bounce_pause_pct: 10,
  bounce_min_sends: 50,
  require_terms: true,
  honor_opt_outs: true,
  allow_export: false,
  stale_days: 180,
  terms_version: 1,
};

/** "No top up". The key stays "free" because the access table defaults to it. */
export const FREE_TIER: DirectoryTier = { key: "free", label: "No top up", hold_limit: 0, email_limit: 0, show_email: false, can_export: false, price_cents: null, sort: 0 };

/** What each founder plan includes: directory contacts and Manual outreach emails per 30 days. */
export type DirectoryPlanAllowance = {
  plan_type: string;
  label: string;
  contacts: number;
  emails_per_month: number;
  sort: number;
};

/** Plan, top up and the totals they add up to. */
export type FounderLimits = {
  plan: string | null;
  planLabel: string;
  allowance: DirectoryPlanAllowance;
  topUp: DirectoryTier;
  /** Directory contacts the founder may hold: plan + top up. */
  contacts: number;
  /** Manual outreach emails per 30 day period: plan + top up. */
  emails: number;
  /** Manual outreach emails sent in the current period. */
  emailsUsed: number;
  /** Start and end of the current 30 day period (counted from signup), ISO. */
  periodStart: string;
  periodEnd: string;
};

/** The founder's standing with the directory, as the import gate sees it. */
export type FounderDirectoryAccess = {
  /** The founder's top up (FREE_TIER when none). */
  tier: DirectoryTier;
  limits: FounderLimits;
  status: AccessStatus;
  statusReason: string | null;
  termsAccepted: boolean;
  termsAcceptedAt: string | null;
  held: number;
  importedToday: number;
};

/** founder_investor_contacts.source for contacts imported from the directory. */
export const DIRECTORY_CONTACT_SOURCE = "directory";

/** Shown wherever directory data appears. */
export const DIRECTORY_DISCLAIMER =
  "Not the iCFO Capital investor network. Compiled from public sources; iCFO Capital has no relationship with these investors and does not introduce you to them. iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.";

/** One line used beside every directory allowance (plan cards, tiles, dialogs). */
export const NOT_NETWORK_NOTE = "Public data, not the iCFO Capital investor network";
