/**
 * Every profile field the admin page manages: its option list, its edit rules,
 * and where it is wired.
 *
 * Pure data. The Where used tab renders it, and usage.test.ts checks it against
 * the code, so a form that starts using a list without being listed here fails
 * the build instead of quietly making this page wrong.
 */

import type { VocabularyList } from "@/lib/vocabulary/lists";
import type { EngineWeights } from "@/lib/matching/investor-company-matching";

export type SectionGroup = "Company profile" | "Revenue and financials" | "Investor fit";

export type FieldSection = {
  list: VocabularyList;
  title: string;
  group: SectionGroup;
  note: string;
  /** Matching factor this list feeds, if any. */
  factor?: keyof EngineWeights;
  /** New options may be added. Off where stored keys are read by code. */
  addable: boolean;
  /** Stored value equals the label at creation (bands the matcher parses). */
  slugIsLabel: boolean;
  /** Forms read this list from the table, so edits reach users. */
  wired: boolean;
  /** Company columns whose answers are counted per option. */
  answerColumns?: string[];
  /** Shows a second line under each option. */
  hasDescription?: boolean;
};

export const FIELD_SECTIONS: FieldSection[] = [
  { list: "industry", title: "Industry", group: "Company profile", note: "Founder, investor, event registration, sector tracks.", factor: "sector", addable: true, slugIsLabel: false, wired: false },
  { list: "funding_stage", title: "Funding stage", group: "Company profile", note: "The round being raised.", factor: "stage", addable: true, slugIsLabel: false, wired: false },
  { list: "operating_stage", title: "Operating stage", group: "Company profile", note: "The company itself. Feeds the stage factor.", addable: true, slugIsLabel: false, wired: false },

  { list: "revenue_size", title: "Annual revenue size", group: "Revenue and financials", note: "Last 12 months. Onboarding step 8, founder settings, investor one-pager.", addable: true, slugIsLabel: true, wired: true, answerColumns: ["annual_revenue_size"] },
  { list: "revenue_stage", title: "Revenue stage", group: "Revenue and financials", note: "Onboarding step 3, founder settings. Feeds the stage factor. Keys are read by matching code, so they are fixed.", factor: "stage", addable: false, slugIsLabel: false, wired: true, answerColumns: ["revenue_stage"], hasDescription: true },
  { list: "arr_band", title: "ARR", group: "Revenue and financials", note: "Founder settings. Scored against the investor's preferred ARR range.", factor: "arr", addable: true, slugIsLabel: true, wired: true, answerColumns: ["arr"] },
  { list: "mrr_band", title: "MRR", group: "Revenue and financials", note: "Founder settings. Scored against the investor's preferred MRR range.", factor: "mrr", addable: true, slugIsLabel: true, wired: true, answerColumns: ["mrr"] },
  { list: "money_band", title: "Annual EBITDA and Amount of capital", group: "Revenue and financials", note: "The nine contact record bands. Current EBITDA only, never projected. No Add: new options would not exist in the contact records.", factor: "checkSize", addable: false, slugIsLabel: true, wired: true, answerColumns: ["annual_ebitda", "funding_amount_band"] },

  { list: "investor_type", title: "Investor type", group: "Investor fit", note: "What the founder seeks, and what the investor is.", factor: "investorType", addable: true, slugIsLabel: false, wired: false },
  { list: "capital_type", title: "Capital type", group: "Investor fit", note: "Founders answer it. No investor is asked, so the factor never scores.", factor: "capitalType", addable: true, slugIsLabel: false, wired: false },
  { list: "geography", title: "Geography", group: "Investor fit", note: "Regions for matching. Not yet asked as a selection.", factor: "geography", addable: true, slugIsLabel: false, wired: false },
  { list: "use_of_funds", title: "Use of funds", group: "Investor fit", note: "Founder onboarding. Read by the CRM investor scorer.", addable: true, slugIsLabel: false, wired: false },
  { list: "business_entity", title: "Business entity", group: "Investor fit", note: "Founder profile. Not scored.", addable: true, slugIsLabel: false, wired: false },
];

export function sectionFor(list: VocabularyList): FieldSection | undefined {
  return FIELD_SECTIONS.find((s) => s.list === list);
}

/* ── Where used ─────────────────────────────────────────────────────────── */

export const SURFACES = [
  "Founder onboarding",
  "Founder settings",
  "Investor onboarding",
  "Event registration",
  "Networking board",
  "Matching",
  "Event introductions",
  "Other",
] as const;
export type Surface = (typeof SURFACES)[number];

export type CellKind = "picks" | "scores" | "typed" | "never" | "none";
export type Cell = { kind: CellKind; note?: string };

export type FieldUsage = {
  name: string;
  /** The managed list, when there is one. */
  list?: VocabularyList;
  summary: string;
  cells: Partial<Record<Surface, Cell>>;
  screens: string[];
  stored: string[];
  saved: string[];
  read: string[];
  optionList: string[];
  /**
   * Source files that use this field's option list. usage.test.ts fails when
   * the code uses a list constant in a file missing from here.
   */
  codeRefs: string[];
};

const ONB = "src/components/founder/FounderConversationalOnboarding.tsx";
const SET = "src/app/founder/settings/settings-form.tsx";
const ADM_CONTACT = "src/app/admin/sales/contacts/[id]/CompanyLinkedRecordEditor.tsx";
const ADM_BASICS = "src/components/admin/company-workspace/CompanyBasicsEditor.tsx";
const PIPE = "src/app/founder/investor-pipeline/InvestorPipelineClient.tsx";
const ROUTES_COMPANY = ["PATCH /api/founder/onboarding", "PATCH /api/companies/[id]", "PATCH /api/admin/companies/[id]/basics"];

export const FIELD_USAGE: FieldUsage[] = [
  {
    name: "Industry", list: "industry", summary: "companies.industry · investor preferred sectors · event sector",
    cells: {
      "Founder onboarding": { kind: "picks", note: "step 2" }, "Founder settings": { kind: "picks" },
      "Investor onboarding": { kind: "typed", note: "sectors of interest" }, "Event registration": { kind: "picks", note: "separate event sector copy" },
      "Networking board": { kind: "scores", note: "sector pairing" }, Matching: { kind: "scores", note: "sector" },
      "Event introductions": { kind: "scores", note: "match reason" }, Other: { kind: "none", note: "admin editors, investor pipeline filter" },
    },
    screens: ["/founder/onboarding step 2", "/founder/settings", "/admin/sales/contacts/[id]", "/admin/companies/[companyId]", "/investor/onboarding (typed)", "/events/[slug]/register (event sector copy)", "/founder/investor-pipeline (filter)"],
    stored: ["companies.industry", "investor_profiles.preferred_sectors", "event registration answer: sector"],
    saved: [...ROUTES_COMPANY, "POST /api/investor/onboarding"],
    read: ["investor-company-matching.ts · sector", "preference-match.ts · CRM scorer", "icfo-events/matching-rule.ts · networking pairing", "icfo-events/match-reason.ts · introduction reason"],
    optionList: ["src/lib/industries.ts", "src/lib/icfo-events/sectors.ts (second copy)"],
    codeRefs: [SET, ADM_CONTACT, ADM_BASICS, PIPE],
  },
  {
    name: "Funding stage", list: "funding_stage", summary: "companies.funding_stage",
    cells: {
      "Founder onboarding": { kind: "picks", note: "step 7" }, "Founder settings": { kind: "picks" },
      "Investor onboarding": { kind: "typed", note: "preferred stages" }, Matching: { kind: "scores", note: "stage" },
      Other: { kind: "none", note: "admin editor, investor pipeline filter" },
    },
    screens: ["/founder/onboarding step 7", "/founder/settings", "/admin/sales/contacts/[id]", "/investor/onboarding preferred stages (typed)", "/founder/investor-pipeline (filter)"],
    stored: ["companies.funding_stage", "investor_profiles.preferred_stages"],
    saved: ROUTES_COMPANY, read: ["investor-company-matching.ts · stage", "contact-match.ts · stage"],
    optionList: ["FUNDING_STAGE_OPTIONS in profile/options.ts"], codeRefs: [ONB, SET, PIPE],
  },
  {
    name: "Operating stage", list: "operating_stage", summary: "companies.operating_stage",
    cells: { "Founder onboarding": { kind: "picks", note: "step 7" }, "Founder settings": { kind: "picks" }, Matching: { kind: "scores", note: "part of stage" }, Other: { kind: "none", note: "admin editor" } },
    screens: ["/founder/onboarding step 7", "/founder/settings", "/admin/sales/contacts/[id]"],
    stored: ["companies.operating_stage"], saved: ROUTES_COMPANY,
    read: ["load-matching-data.ts and contact-match.ts · joined into the stage factor"],
    optionList: ["OPERATING_STAGE_OPTIONS in profile/options.ts"], codeRefs: [ONB, SET],
  },
  {
    name: "Revenue stage", list: "revenue_stage", summary: "companies.revenue_stage",
    cells: { "Founder onboarding": { kind: "picks", note: "step 3" }, "Founder settings": { kind: "picks" }, Matching: { kind: "scores", note: "stage; CRM revenue range" }, Other: { kind: "none", note: "admin editors" } },
    screens: ["/founder/onboarding step 3", "/founder/settings", "/admin/sales/contacts/[id]", "/admin/companies/[companyId]"],
    stored: ["companies.revenue_stage"], saved: ROUTES_COMPANY,
    read: ["investor-company-matching.ts · stage", "preference-match.ts · revenue range and use of funds"],
    optionList: ["revenue_stage list on this page"], codeRefs: [ONB, SET],
  },
  {
    name: "Annual revenue size", list: "revenue_size", summary: "companies.annual_revenue_size",
    cells: { "Founder onboarding": { kind: "picks", note: "step 8" }, "Founder settings": { kind: "picks" }, Other: { kind: "none", note: "investor one-pager; admin editor" } },
    screens: ["/founder/onboarding step 8", "/founder/settings", "/admin/sales/contacts/[id]", "/f/[slug] investor one-pager"],
    stored: ["companies.annual_revenue_size"], saved: ROUTES_COMPANY, read: ["Not read by any matcher"],
    optionList: ["revenue_size list on this page"], codeRefs: [ONB, SET, ADM_CONTACT],
  },
  {
    name: "ARR", list: "arr_band", summary: "companies.arr · investor preferred ARR range",
    cells: { "Founder onboarding": { kind: "picks", note: "step 8" }, "Founder settings": { kind: "picks" }, "Investor onboarding": { kind: "picks", note: "preferred ARR range" }, Matching: { kind: "scores", note: "ARR" }, Other: { kind: "none", note: "admin editor" } },
    screens: ["/founder/onboarding step 8", "/founder/settings", "/admin/sales/contacts/[id]", "/investor/onboarding preferred ARR range"],
    stored: ["companies.arr", "investor_profiles.preferred_arr_range"], saved: [...ROUTES_COMPANY, "POST /api/investor/onboarding"],
    read: ["investor-company-matching.ts · ARR"], optionList: ["arr_band list on this page"], codeRefs: [ONB, SET, ADM_CONTACT],
  },
  {
    name: "MRR", list: "mrr_band", summary: "companies.mrr · investor preferred MRR range",
    cells: { "Founder onboarding": { kind: "picks", note: "step 8" }, "Founder settings": { kind: "picks" }, "Investor onboarding": { kind: "picks", note: "preferred MRR range" }, Matching: { kind: "scores", note: "MRR" }, Other: { kind: "none", note: "admin editor" } },
    screens: ["/founder/onboarding step 8", "/founder/settings", "/admin/sales/contacts/[id]", "/investor/onboarding preferred MRR range"],
    stored: ["companies.mrr", "investor_profiles.preferred_mrr_range"], saved: [...ROUTES_COMPANY, "POST /api/investor/onboarding"],
    read: ["investor-company-matching.ts · MRR"], optionList: ["mrr_band list on this page"], codeRefs: [ONB, SET, ADM_CONTACT],
  },
  {
    name: "Annual EBITDA", list: "money_band", summary: "companies.annual_ebitda",
    cells: { "Founder onboarding": { kind: "picks", note: "step 7" }, "Founder settings": { kind: "picks" }, Other: { kind: "none", note: "both admin editors" } },
    screens: ["/founder/onboarding step 7", "/founder/settings", "/admin/sales/contacts/[id]"],
    stored: ["companies.annual_ebitda"], saved: ROUTES_COMPANY, read: ["Not read by any matcher"],
    optionList: ["money_band list on this page (shared with Amount of capital)"], codeRefs: [ONB, SET, ADM_CONTACT],
  },
  {
    name: "Amount of capital", list: "money_band", summary: "companies.funding_amount_band + funding_amount",
    cells: { "Founder onboarding": { kind: "picks", note: "step 4" }, "Founder settings": { kind: "picks" }, "Investor onboarding": { kind: "typed", note: "check size min / max" }, Matching: { kind: "scores", note: "check size" }, Other: { kind: "none", note: "both admin editors; about 90 files read the exact figure" } },
    screens: ["/founder/onboarding step 4", "/founder/settings", "/admin/sales/contacts/[id]", "/admin/companies/[companyId]", "/investor/onboarding check size min / max (typed)"],
    stored: ["companies.funding_amount_band", "companies.funding_amount (kept in step by trg_companies_funding_band)", "investor_profiles.check_size_min / max"],
    saved: [...ROUTES_COMPANY, "POST /api/investor/onboarding"],
    read: ["investor-company-matching.ts · check size", "preference-match.ts · CRM check size", "About 90 files read the exact figure (valuation, cap table, pitch deck, business plan)"],
    optionList: ["money_band list on this page"], codeRefs: [ONB, SET, ADM_CONTACT, ADM_BASICS],
  },
  {
    name: "Investor type", list: "investor_type", summary: "companies.seeking_investor_types · investor_profiles.investor_type",
    cells: { "Founder onboarding": { kind: "picks", note: "step 7" }, "Founder settings": { kind: "picks" }, "Investor onboarding": { kind: "picks", note: "separate investor list" }, Matching: { kind: "scores", note: "investor type" }, Other: { kind: "none", note: "admin editor, investor pipeline filter" } },
    screens: ["/founder/onboarding step 7", "/founder/settings", "/admin/sales/contacts/[id]", "/investor/onboarding", "/founder/investor-pipeline (filter)"],
    stored: ["companies.seeking_investor_types", "investor_profiles.investor_type"], saved: [...ROUTES_COMPANY, "POST /api/investor/onboarding"],
    read: ["investor-company-matching.ts · investor type", "preference-match.ts"],
    optionList: ["INVESTOR_TYPE_OPTIONS in profile/options.ts", "INVESTOR_TYPES in investor/types.ts (second list)"], codeRefs: [ONB, SET, PIPE],
  },
  {
    name: "Capital type", list: "capital_type", summary: "companies.seeking_capital_types",
    cells: { "Founder onboarding": { kind: "picks", note: "step 7" }, "Founder settings": { kind: "picks" }, Matching: { kind: "never", note: "no investor side" }, Other: { kind: "none", note: "admin editor" } },
    screens: ["/founder/onboarding step 7", "/founder/settings", "/admin/sales/contacts/[id]"],
    stored: ["companies.seeking_capital_types"], saved: ROUTES_COMPANY,
    read: ["investor-company-matching.ts · capital type, never scores: no investor side"],
    optionList: ["CAPITAL_TYPE_OPTIONS in profile/options.ts"], codeRefs: [ONB, SET],
  },
  {
    name: "Geography", list: "geography", summary: "companies.country, state · investor preferred geographies",
    cells: { "Founder onboarding": { kind: "typed", note: "country, state" }, "Founder settings": { kind: "typed" }, "Investor onboarding": { kind: "typed", note: "preferred geographies" }, Matching: { kind: "scores", note: "geography" } },
    screens: ["/founder/onboarding step 1 (typed)", "/founder/settings (typed)", "/investor/onboarding (typed)"],
    stored: ["companies.country, companies.state", "investor_profiles.preferred_geographies"], saved: ["PATCH /api/founder/onboarding", "PATCH /api/companies/[id]", "POST /api/investor/onboarding"],
    read: ["investor-company-matching.ts · geography"], optionList: ["Geography list on this page is not used by any form yet"], codeRefs: [],
  },
  {
    name: "Use of funds", list: "use_of_funds", summary: "companies.use_of_funds",
    cells: { "Founder onboarding": { kind: "picks", note: "step 6" }, "Founder settings": { kind: "typed", note: "prose field" }, Matching: { kind: "scores", note: "CRM scorer only" } },
    screens: ["/founder/onboarding step 6", "/founder/settings (prose)"], stored: ["companies.use_of_funds"],
    saved: ["PATCH /api/founder/onboarding", "PATCH /api/companies/[id]"], read: ["preference-match.ts · CRM scorer, stage and use of funds"],
    optionList: ["USE_OF_FUNDS_OPTIONS in profile/options.ts"], codeRefs: [ONB],
  },
  {
    name: "Business entity", list: "business_entity", summary: "companies.business_entity",
    cells: { "Founder onboarding": { kind: "picks", note: "step 7" }, "Founder settings": { kind: "picks" }, Other: { kind: "none", note: "admin editor" } },
    screens: ["/founder/onboarding step 7", "/founder/settings", "/admin/sales/contacts/[id]"], stored: ["companies.business_entity"], saved: ROUTES_COMPANY,
    read: ["Not read by any matcher"], optionList: ["BUSINESS_ENTITY_OPTIONS in profile/options.ts"], codeRefs: [ONB, SET],
  },
];

/** Which option constants map to which field, for the drift test. */
export const LIST_CONSTANTS: Record<string, string> = {
  FUNDING_STAGE_OPTIONS: "Funding stage",
  OPERATING_STAGE_OPTIONS: "Operating stage",
  INVESTOR_TYPE_OPTIONS: "Investor type",
  CAPITAL_TYPE_OPTIONS: "Capital type",
  USE_OF_FUNDS_OPTIONS: "Use of funds",
  BUSINESS_ENTITY_OPTIONS: "Business entity",
  industryOptionsFor: "Industry",
  INDUSTRY_OPTIONS: "Industry",
  // Managed lists, read through the vocabulary provider.
  're:(vocab\\w*\\.|list: "|listOptions\\("|\\(\\)\\.)revenue_size\\b': "Annual revenue size",
  're:(vocab\\w*\\.|list: "|listOptions\\("|\\(\\)\\.)revenue_stage\\b': "Revenue stage",
  're:(vocab\\w*\\.|list: "|listOptions\\("|\\(\\)\\.)arr_band\\b': "ARR",
  're:(vocab\\w*\\.|list: "|listOptions\\("|\\(\\)\\.)mrr_band\\b': "MRR",
  're:(vocab\\w*\\.|list: "|listOptions\\("|\\(\\)\\.)money_band\\b': "Amount of capital",
  MONEY_BAND_OPTIONS: "Amount of capital",
  EBITDA_BAND_OPTIONS: "Annual EBITDA",
  FUNDING_AMOUNT_BAND_OPTIONS: "Amount of capital",
};
