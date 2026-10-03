// Keys of the masters the app ships with (master-seeds.ts), kept light so
// pages can check for uninstalled masters without loading the Word files.
// master-seeds.test.ts keeps this list in step with MASTER_SEEDS.
export const MASTER_SEED_KEYS = [
  "term_sheet_convertible_note",
  "term_sheet_safe",
  "term_sheet_series_a",
  "dd_services_agreement",
  "dd_services_agreement_3mo",
  "dd_services_agreement_stock_cash",
] as const;
