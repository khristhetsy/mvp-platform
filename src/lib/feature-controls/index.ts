import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type FeatureAudience = "founder" | "investor" | "admin";
// Keys are stable string identifiers stored in feature_flags.feature. Existing
// keys (inbox/calendar/scheduling/tasks/signatures/diligence/regcf) are kept so
// previously-saved flags continue to apply.
export type FeatureKey = string;

export const FEATURE_AUDIENCES: FeatureAudience[] = ["founder", "investor", "admin"];

export interface FeatureDef {
  key: string;
  label: string;
  group: string;
  /** Nav hrefs this feature governs, per audience. Disjoint within an audience. */
  hrefs: Partial<Record<FeatureAudience, string[]>>;
  /** Audiences that get a switch for a feature that governs no nav href (an in-page feature such as Pledged). */
  audiences?: FeatureAudience[];
}

/**
 * Single source of truth for the feature-controls matrix. Each entry maps a
 * toggleable feature to the nav hrefs it hides (per audience) when disabled.
 * Essentials (dashboards, settings/profile, and the Feature Controls page
 * itself) are intentionally NOT listed — they can't be turned off.
 */
export const FEATURES: FeatureDef[] = [
  // ── Workspace ──────────────────────────────────────────────────────────
  { key: "journey", label: "My Progress", group: "Workspace", hrefs: { founder: ["/founder/journey"] } },
  { key: "command_center", label: "Command Center", group: "Workspace", hrefs: { founder: ["/founder/command-center"] } },
  { key: "action_center", label: "Action Center", group: "Workspace", hrefs: { founder: ["/founder/actions"], investor: ["/investor/actions"], admin: ["/admin/actions"] } },
  { key: "onboarding", label: "Onboarding", group: "Workspace", hrefs: { investor: ["/investor/onboarding"] } },

  // ── Communications ─────────────────────────────────────────────────────
  { key: "inbox", label: "Inbox", group: "Communications", hrefs: { founder: ["/founder/inbox"], investor: ["/investor/inbox"], admin: ["/admin/inbox"] } },
  { key: "messages", label: "Messages & updates", group: "Communications", hrefs: { founder: ["/founder/messages", "/founder/updates"], investor: ["/investor/messages"] } },
  { key: "calendar", label: "Calendar", group: "Communications", hrefs: { founder: ["/founder/calendar"], investor: ["/investor/calendar"], admin: ["/admin/calendar", "/admin/meet"] } },
  { key: "scheduling", label: "Scheduling", group: "Communications", hrefs: { founder: ["/founder/schedule"], investor: ["/investor/schedule"], admin: ["/admin/schedule"] } },
  { key: "notifications", label: "Notifications", group: "Communications", hrefs: { founder: ["/notifications"], investor: ["/notifications"] } },

  // ── Fundraising & market ───────────────────────────────────────────────
  { key: "private_market", label: "Private Market", group: "Fundraising & market", hrefs: {
    founder: ["/founder/private-market", "/private-market"],
    investor: ["/private-market", "/investor/opportunities", "/investor/watchlist", "/investor/interest-pipeline", "/investor/deal-room", "/investor/deals", "/investor/spvs", "/investor/portfolio", "/investor/activity"],
    admin: ["/private-market", "/admin/private-market/weekly-emailer"],
  } },
  { key: "fundraising", label: "Fundraising suite", group: "Fundraising & market", hrefs: {
    founder: ["/founder/investors", "/founder/matching", "/founder/investors/outreach", "/founder/investors/matches", "/founder/deal-room", "/founder/capital-raise"],
  } },
  // Own switch so SPVs & closings can be turned off while Deal Room and Capital Raise stay on.
  { key: "founder_spvs", label: "SPVs & closings", group: "Fundraising & market", hrefs: {
    founder: ["/founder/spvs"],
  } },
  { key: "investor_crm", label: "Investor CRM", group: "Fundraising & market", hrefs: {
    founder: ["/founder/investor-pipeline"],
  } },
  { key: "investor_directory", label: "Investor directory", group: "Fundraising & market", hrefs: {
    founder: ["/founder/investor-directory"],
    admin: [
      "/admin/investor-directory",
      "/admin/investor-directory/records",
      "/admin/investor-directory/imports",
      "/admin/investor-directory/verification",
      "/admin/investor-directory/access",
      "/admin/investor-directory/usage",
    ],
  } },
  { key: "ir_agent", label: "Founder IR Agent (Build Your Agent)", group: "Fundraising & market", hrefs: {
    founder: ["/founder/ir-agent"],
  } },
  { key: "events", label: "Events", group: "Fundraising & market", hrefs: { founder: ["/events", "/founder/events"], investor: ["/events"], admin: ["/admin/events", "/admin/events/dashboard", "/admin/events/applications", "/admin/events/sponsors", "/admin/events/analytics", "/admin/events/gamification", "/admin/events/email", "/admin/events/invitations", "/admin/events/registrations", "/admin/events/networking", "/admin/events/brochure", "/admin/studio", "/admin/studio/spotlight", "/admin/studio/talk-show"] } },
  { key: "partner_score", label: "Partner Score", group: "Fundraising & market", hrefs: { investor: ["/investor/partner-score"] } },
  { key: "my_contacts", label: "My contacts", group: "Fundraising & market", hrefs: { founder: ["/founder/contacts"] } },
  { key: "investor_matches", label: "Investor matches", group: "Fundraising & market", hrefs: { founder: ["/founder/matches"] } },
  { key: "outreach", label: "Outreach", group: "Fundraising & market", hrefs: { founder: ["/founder/deploy"] } },
  { key: "present_at_event", label: "Present at event", group: "Fundraising & market", hrefs: { founder: ["/founder/events/present"] } },
  { key: "offering_type", label: "Offering type", group: "Fundraising & market", hrefs: { founder: ["/founder/offering-type"] } },
  // In-page feature, no nav href. Off hides pledge amounts and totals wherever a screen checks it.
  { key: "pledged", label: "Pledged amounts", group: "Fundraising & market", hrefs: {}, audiences: ["founder", "investor", "admin"] },
  // In-page feature, no nav href. Off hides Facebook and LinkedIn groups from the Social Media Compose "Post to" list.
  { key: "group_share", label: "Social Media: Group share", group: "Fundraising & market", hrefs: {}, audiences: ["admin"] },
  // In-page feature, no nav href. Off hides the founder home banner and stops the weekly email that asks paid founders to connect with investors.
  { key: "social_nudge", label: "Social Media: Connect with investors nudge", group: "Fundraising & market", hrefs: {}, audiences: ["founder"] },

  // ── Readiness & documents ──────────────────────────────────────────────
  { key: "readiness", label: "Readiness", group: "Readiness & documents", hrefs: { founder: ["/founder/readiness", "/founder/readiness/wizard", "/founder/readiness/diligence", "/founder/readiness/documents", "/founder/report"] } },
  { key: "documents", label: "Documents", group: "Readiness & documents", hrefs: { founder: ["/founder/documents"] } },
  { key: "data_room", label: "Data room", group: "Readiness & documents", hrefs: { founder: ["/founder/readiness/data-room"] } },
  { key: "one_pager", label: "One pager", group: "Readiness & documents", hrefs: { founder: ["/founder/preview"] } },

  // ── Raise Toolkit ──────────────────────────────────────────────────────
  { key: "raise_toolkit_guides", label: "Raise Toolkit guides", group: "Raise Toolkit", hrefs: { founder: ["/founder/term-sheet", "/founder/pitch-practice", "/founder/email-sequence", "/founder/due-diligence", "/founder/investor-update", "/founder/funding-timeline", "/founder/board-prep", "/founder/kpi-glossary"] } },
  { key: "pitch_deck_analyzer", label: "Pitch deck analyzer", group: "Raise Toolkit", hrefs: { founder: ["/founder/pitch-deck-analyzer"] } },
  { key: "valuation", label: "Valuation range and advisor", group: "Raise Toolkit", hrefs: { founder: ["/founder/valuation"] } },
  { key: "business_plan", label: "AI Business Plan", group: "Raise Toolkit", hrefs: { founder: ["/founder/business-plan"] } },
  { key: "term_sheet_creator", label: "Term sheet creator", group: "Raise Toolkit", hrefs: { founder: ["/founder/term-sheet-creator"] } },
  // Term sheet creator sub switches. In page features, so they have no nav href. Founder and Admin only.
  { key: "term_sheet_round_structure", label: "Term sheet: generate from Round structure", group: "Raise Toolkit", hrefs: {}, audiences: ["founder", "admin"] },
  { key: "term_sheet_documents_upload", label: "Term sheet: upload to Documents", group: "Raise Toolkit", hrefs: {}, audiences: ["founder", "admin"] },
  { key: "term_sheet_word_export", label: "Term sheet: Word export", group: "Raise Toolkit", hrefs: {}, audiences: ["founder", "admin"] },
  { key: "pitch_deck", label: "Pitch deck", group: "Raise Toolkit", hrefs: { founder: ["/founder/pitch-deck"] } },
  { key: "market_claim", label: "Market claim grader", group: "Raise Toolkit", hrefs: { founder: ["/founder/market-claim"] } },
  { key: "round_structure", label: "Round structure", group: "Raise Toolkit", hrefs: { founder: ["/founder/round-structure"] } },
  { key: "financial_model", label: "Financial model", group: "Raise Toolkit", hrefs: { founder: ["/founder/financial-model"] } },
  { key: "cap_table", label: "Cap table", group: "Raise Toolkit", hrefs: { founder: ["/founder/cap-table"] } },
  { key: "regcf", label: "Reg CF generator", group: "Raise Toolkit", hrefs: { founder: ["/founder/reg-cf"] } },

  // ── Growth ─────────────────────────────────────────────────────────────
  { key: "learning", label: "Learning", group: "Growth", hrefs: {
    founder: ["/founder/learning", "/founder/learning/courses", "/founder/learning/plan", "/founder/learning/schedule", "/founder/learning/progress", "/founder/learning/stages/stage_0", "/founder/learning/stages/stage_1", "/founder/learning/stages/stage_2", "/founder/learning/stages/stage_3"],
    investor: ["/investor/learning"],
    admin: ["/admin/learning", "/admin/learning/courses", "/admin/learning/founders", "/admin/learning/coach"],
  } },
  { key: "milestones", label: "Milestones", group: "Growth", hrefs: { founder: ["/founder/milestones"] } },
  { key: "analytics", label: "Analytics", group: "Growth", hrefs: { founder: ["/founder/analytics"], investor: ["/investor/analytics"], admin: ["/admin/analytics", "/admin/reports", "/admin/insights", "/admin/funnels", "/admin/message-activity"] } },
  { key: "tasks", label: "Tasks", group: "Growth", hrefs: { founder: ["/founder/tasks"], investor: ["/investor/tasks"], admin: ["/admin/tasks"] } },

  // ── Admin: relationships ───────────────────────────────────────────────
  { key: "companies", label: "Companies", group: "Admin · relationships", hrefs: { admin: ["/admin/companies"] } },
  { key: "investors", label: "Investors", group: "Admin · relationships", hrefs: { admin: ["/admin/investors", "/admin/investors/enrich"] } },
  { key: "crm", label: "Investor Relations CRM", group: "Admin · relationships", hrefs: { admin: ["/admin/crm", "/admin/crm/pipeline", "/admin/crm/messages", "/admin/crm/outreach", "/admin/crm/unclassified", "/admin/crm/connectors"] } },
  { key: "intro_requests", label: "Intro requests", group: "Admin · relationships", hrefs: { admin: ["/admin/intro-requests", "/admin/prospect-intros"] } },
  { key: "deal_rooms", label: "Deal rooms", group: "Admin · relationships", hrefs: { admin: ["/admin/deal-rooms"] } },
  { key: "spvs", label: "SPVs", group: "Admin · relationships", hrefs: { admin: ["/admin/spvs"] } },
  { key: "matching", label: "Matching", group: "Admin · relationships", hrefs: { admin: ["/admin/matching", "/admin/matching/prospects", "/admin/outreach-qualification", "/admin/partner-scores"] } },
  { key: "portfolio", label: "Portfolio", group: "Admin · relationships", hrefs: { admin: ["/admin/portfolio"] } },
  { key: "readiness_scores", label: "Readiness scores", group: "Admin · relationships", hrefs: { admin: ["/admin/readiness"] } },

  { key: "contacts", label: "Contacts", group: "Admin · relationships", hrefs: { admin: ["/admin/contacts"] } },
  { key: "ceo", label: "CEO", group: "Admin · relationships", hrefs: { admin: ["/admin/ceo"] } },
  { key: "sales", label: "Sales", group: "Admin · relationships", hrefs: { admin: ["/admin/sales", "/admin/sales/opportunities", "/admin/sales/pipeline", "/admin/sales/contracts", "/admin/sales/scheduled-emails", "/admin/sales/task-report", "/admin/sales/settings"] } },
  { key: "ir_projects", label: "Investor Relations (projects)", group: "Admin · relationships", hrefs: { admin: ["/admin/ir", "/admin/ir/projects", "/admin/ir/tasks", "/admin/ir/import"] } },
  // ── Admin: operations ──────────────────────────────────────────────────
  { key: "marketing", label: "Marketing", group: "Admin · operations", hrefs: { admin: ["/admin/marketing", "/admin/marketing/contacts", "/admin/marketing/campaigns", "/admin/marketing/sequences", "/admin/marketing/templates", "/admin/marketing/lists", "/admin/marketing/suppressions", "/admin/marketing/analytics", "/admin/marketing/plan", "/admin/marketing/deal-notices", "/admin/marketing/partner-codes", "/admin/marketing/testimonials", "/admin/marketing/aeo", "/admin/marketing/settings/notifications"] } },
  { key: "compliance", label: "Compliance & audit", group: "Admin · operations", hrefs: { admin: ["/admin/compliance", "/admin/audit"] } },
  { key: "signatures", label: "E-Signatures", group: "Admin · operations", hrefs: { admin: ["/admin/signatures"] } },
  { key: "diligence", label: "Diligence", group: "Admin · operations", hrefs: { admin: ["/admin/diligence", "/admin/data-room"] } },
  { key: "billing", label: "Billing", group: "Admin · operations", hrefs: { admin: ["/admin/billing", "/admin/pricing"] } },
  { key: "user_management", label: "User management", group: "Admin · operations", hrefs: { admin: ["/admin/users/manage", "/admin/users/permissions", "/admin/accounts"] } },
  { key: "system_integrations", label: "System & integrations", group: "Admin · operations", hrefs: { admin: ["/admin/system", "/admin/integrations", "/admin/queues", "/admin/automation", "/admin/page-builder-lab", "/admin/system-health", "/admin/imports", "/admin/beta-operations", "/admin/scheduled-jobs"] } },
  { key: "accounting", label: "Accounting", group: "Admin · operations", hrefs: { admin: ["/admin/accounting", "/admin/accounting/customers", "/admin/accounting/invoices", "/admin/accounting/payments", "/admin/accounting/bank", "/admin/accounting/reports", "/admin/accounting/settings"] } },
  { key: "social_media", label: "Social Media", group: "Admin · operations", hrefs: { admin: ["/admin/social"] } },
  { key: "linkedin", label: "LinkedIn", group: "Admin · operations", hrefs: { admin: ["/admin/linkedin"] } },
  { key: "ai_agent", label: "AI Agent", group: "Admin · operations", hrefs: { admin: ["/admin/ai-agent"] } },
  { key: "voice", label: "Voice", group: "Admin · operations", hrefs: { admin: ["/admin/voice", "/admin/voice/campaigns", "/admin/voice/calls", "/admin/voice/consent-ledger", "/admin/voice/performance"] } },
  { key: "meetings", label: "Meetings", group: "Admin · operations", hrefs: { admin: ["/admin/meetings"] } },
  { key: "account_activity", label: "Account Activity", group: "Admin · operations", hrefs: { admin: ["/admin/activity", "/admin/activity/alerts", "/admin/activity/assignments"] } },
  { key: "funnels", label: "Funnels", group: "Admin · operations", hrefs: { admin: ["/admin/ir-funnel", "/admin/fit"] } },
  { key: "support", label: "Support", group: "Admin · operations", hrefs: { admin: ["/admin/support", "/admin/support/log", "/admin/founders-stuck"] } },
  { key: "ai_usage", label: "AI usage and cost", group: "Admin · operations", hrefs: { admin: ["/admin/ai-usage"] } },
  { key: "ops_manual", label: "Operations Manual", group: "Admin · operations", hrefs: { admin: ["/admin/manual"] } },
];

export const FEATURE_KEYS: FeatureKey[] = FEATURES.map((f) => f.key);
export const FEATURE_KEY_SET: ReadonlySet<string> = new Set(FEATURE_KEYS);

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(FEATURES.map((f) => [f.key, f.label]));

/** Ordered, de-duplicated group names for the matrix UI. */
export const FEATURE_GROUPS: string[] = FEATURES.reduce<string[]>((acc, f) => {
  if (!acc.includes(f.group)) acc.push(f.group);
  return acc;
}, []);

/** Per-audience href map: audience → feature key → hrefs. */
export const FEATURE_HREFS: Record<FeatureAudience, Record<string, string[]>> = {
  founder: {},
  investor: {},
  admin: {},
};
for (const f of FEATURES) {
  for (const audience of FEATURE_AUDIENCES) {
    const hrefs = f.hrefs[audience];
    if (hrefs && hrefs.length > 0) FEATURE_HREFS[audience][f.key] = hrefs;
  }
}

/** Features that exist for an audience (a governed href, or listed in the feature's `audiences`). */
export function featuresForAudience(audience: FeatureAudience): FeatureKey[] {
  return FEATURE_KEYS.filter((f) => appliesTo(audience, f));
}

/** Whether a feature applies to an audience (drives the matrix UI). */
export function appliesTo(audience: FeatureAudience, feature: FeatureKey): boolean {
  if ((FEATURE_HREFS[audience][feature]?.length ?? 0) > 0) return true;
  return FEATURES.some((f) => f.key === feature && (f.audiences ?? []).includes(audience));
}

/** Flat map keyed `${audience}:${feature}` → enabled. Missing key = enabled. */
export type FeatureFlagMap = Record<string, boolean>;

function flagKey(audience: FeatureAudience, feature: FeatureKey): string {
  return `${audience}:${feature}`;
}

// feature_flags isn't in the generated types yet — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function loadFeatureFlags(supabase: SupabaseClient<Database>): Promise<FeatureFlagMap> {
  const map: FeatureFlagMap = {};
  try {
    const { data } = await raw(supabase).from("feature_flags").select("audience, feature, enabled");
    for (const r of (data ?? []) as Array<{ audience: string; feature: string; enabled: boolean }>) {
      map[`${r.audience}:${r.feature}`] = r.enabled;
    }
  } catch {
    // table missing / error → treat everything as enabled
  }
  return map;
}

/** Features default to enabled unless an admin has explicitly turned them off. */
export function isFeatureEnabled(map: FeatureFlagMap, audience: FeatureAudience, feature: FeatureKey): boolean {
  return map[flagKey(audience, feature)] !== false;
}

/** The nav hrefs that should be hidden for this audience given the flag map. */
export function disabledHrefsFor(map: FeatureFlagMap, audience: FeatureAudience): string[] {
  const hidden: string[] = [];
  for (const feature of featuresForAudience(audience)) {
    if (!isFeatureEnabled(map, audience, feature)) hidden.push(...(FEATURE_HREFS[audience][feature] ?? []));
  }
  return hidden;
}
