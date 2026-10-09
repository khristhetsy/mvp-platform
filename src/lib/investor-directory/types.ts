/** Investor directory: public investor data outside the iCFO network. */

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

export type DirectoryTier = {
  key: string;
  label: string;
  hold_limit: number;
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

export const FREE_TIER: DirectoryTier = { key: "free", label: "Free", hold_limit: 0, show_email: false, can_export: false, price_cents: null, sort: 0 };

/** The founder's standing with the directory, as the import gate sees it. */
export type FounderDirectoryAccess = {
  tier: DirectoryTier;
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
  "Outside the iCFO network. Compiled from public sources; iCFO has no relationship with these investors. iCFO does not solicit securities and is not an investment adviser. Content is for educational purposes only.";
