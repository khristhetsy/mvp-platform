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
}

/**
 * Single source of truth for the feature-controls matrix. Each entry maps a
 * toggleable feature to the nav hrefs it hides (per audience) when disabled.
 * Essentials (dashboards, settings/profile, and the Feature Controls page
 * itself) are intentionally NOT listed — they can't be turned off.
 */
export const FEATURES: FeatureDef[] = [
  // ── Workspace ──────────────────────────────────────────────────────────
  { key: "journey", label: "My Journey", group: "Workspace", hrefs: { founder: ["/founder/journey"] } },
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
    founder: ["/founder/private-market"],
    investor: ["/investor/opportunities", "/investor/watchlist", "/investor/interest-pipeline", "/investor/deal-room", "/investor/deals", "/investor/spvs", "/investor/portfolio", "/investor/activity"],
  } },
  { key: "fundraising", label: "Fundraising suite", group: "Fundraising & market", hrefs: {
    founder: ["/founder/investors", "/founder/matching", "/founder/investor-pipeline", "/founder/investors/outreach", "/founder/investors/matches", "/founder/deal-room", "/founder/capital-raise", "/founder/spvs"],
  } },
  { key: "events", label: "Events", group: "Fundraising & market", hrefs: { founder: ["/events"], investor: ["/events"], admin: ["/admin/events", "/admin/events/applications", "/admin/events/sponsors", "/admin/events/analytics", "/admin/events/gamification"] } },
  { key: "partner_score", label: "Partner Score", group: "Fundraising & market", hrefs: { investor: ["/investor/partner-score"] } },

  // ── Readiness & documents ──────────────────────────────────────────────
  { key: "readiness", label: "Readiness", group: "Readiness & documents", hrefs: { founder: ["/founder/readiness", "/founder/readiness/wizard", "/founder/readiness/diligence", "/founder/readiness/documents", "/founder/report"] } },
  { key: "documents", label: "Documents", group: "Readiness & documents", hrefs: { founder: ["/founder/documents"] } },

  // ── Raise Toolkit ──────────────────────────────────────────────────────
  { key: "raise_toolkit_guides", label: "Raise Toolkit guides", group: "Raise Toolkit", hrefs: { founder: ["/founder/term-sheet", "/founder/pitch-practice", "/founder/email-sequence", "/founder/due-diligence", "/founder/investor-update", "/founder/funding-timeline", "/founder/board-prep", "/founder/kpi-glossary"] } },
  { key: "pitch_deck_analyzer", label: "Pitch deck analyzer", group: "Raise Toolkit", hrefs: { founder: ["/founder/pitch-deck-analyzer"] } },
  { key: "business_plan", label: "AI Business Plan", group: "Raise Toolkit", hrefs: { founder: ["/founder/business-plan"] } },
  { key: "financial_model", label: "Financial model", group: "Raise Toolkit", hrefs: { founder: ["/founder/financial-model"] } },
  { key: "cap_table", label: "Cap table", group: "Raise Toolkit", hrefs: { founder: ["/founder/cap-table"] } },
  { key: "regcf", label: "Reg CF generator", group: "Raise Toolkit", hrefs: { founder: ["/founder/reg-cf"] } },

  // ── Growth ─────────────────────────────────────────────────────────────
  { key: "learning", label: "Learning", group: "Growth", hrefs: {
    founder: ["/founder/learning", "/founder/learning/courses", "/founder/learning/plan", "/founder/learning/schedule", "/founder/learning/progress", "/founder/learning/stages/stage_0", "/founder/learning/stages/stage_1", "/founder/learning/stages/stage_2", "/founder/learning/stages/stage_3"],
    investor: ["/investor/learning"],
    admin: ["/admin/learning", "/admin/learning/courses", "/admin/learning/founders"],
  } },
  { key: "milestones", label: "Milestones", group: "Growth", hrefs: { founder: ["/founder/milestones"] } },
  { key: "analytics", label: "Analytics", group: "Growth", hrefs: { founder: ["/founder/analytics"], investor: ["/investor/analytics"], admin: ["/admin/analytics", "/admin/reports", "/admin/insights"] } },
  { key: "tasks", label: "Tasks", group: "Growth", hrefs: { founder: ["/founder/tasks"], investor: ["/investor/tasks"], admin: ["/admin/tasks"] } },

  // ── Admin: relationships ───────────────────────────────────────────────
  { key: "companies", label: "Companies", group: "Admin · relationships", hrefs: { admin: ["/admin/companies"] } },
  { key: "investors", label: "Investors", group: "Admin · relationships", hrefs: { admin: ["/admin/investors"] } },
  { key: "crm", label: "IR CRM", group: "Admin · relationships", hrefs: { admin: ["/admin/crm", "/admin/crm/pipeline", "/admin/crm/messages", "/admin/crm/outreach"] } },
  { key: "intro_requests", label: "Intro requests", group: "Admin · relationships", hrefs: { admin: ["/admin/intro-requests"] } },
  { key: "deal_rooms", label: "Deal rooms", group: "Admin · relationships", hrefs: { admin: ["/admin/deal-rooms"] } },
  { key: "spvs", label: "SPVs", group: "Admin · relationships", hrefs: { admin: ["/admin/spvs"] } },
  { key: "matching", label: "Matching", group: "Admin · relationships", hrefs: { admin: ["/admin/matching"] } },
  { key: "portfolio", label: "Portfolio", group: "Admin · relationships", hrefs: { admin: ["/admin/portfolio"] } },
  { key: "readiness_scores", label: "Readiness scores", group: "Admin · relationships", hrefs: { admin: ["/admin/readiness"] } },

  // ── Admin: operations ──────────────────────────────────────────────────
  { key: "marketing", label: "Marketing Hub", group: "Admin · operations", hrefs: { admin: ["/admin/marketing", "/admin/marketing/contacts", "/admin/marketing/campaigns", "/admin/marketing/sequences", "/admin/marketing/templates", "/admin/marketing/lists", "/admin/marketing/suppressions", "/admin/marketing/analytics", "/admin/marketing/plan"] } },
  { key: "compliance", label: "Compliance & audit", group: "Admin · operations", hrefs: { admin: ["/admin/compliance", "/admin/audit"] } },
  { key: "signatures", label: "E-Signatures", group: "Admin · operations", hrefs: { admin: ["/admin/signatures"] } },
  { key: "diligence", label: "Diligence", group: "Admin · operations", hrefs: { admin: ["/admin/diligence"] } },
  { key: "billing", label: "Billing", group: "Admin · operations", hrefs: { admin: ["/admin/billing"] } },
  { key: "user_management", label: "User management", group: "Admin · operations", hrefs: { admin: ["/admin/users/manage", "/admin/users/permissions"] } },
  { key: "system_integrations", label: "System & integrations", group: "Admin · operations", hrefs: { admin: ["/admin/integrations", "/admin/queues", "/admin/automation", "/admin/page-builder-lab", "/admin/system-health", "/admin/imports", "/admin/beta-operations"] } },
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

/** Features that exist for an audience (have at least one governed href). */
export function featuresForAudience(audience: FeatureAudience): FeatureKey[] {
  return FEATURE_KEYS.filter((f) => (FEATURE_HREFS[audience][f]?.length ?? 0) > 0);
}

/** Whether a feature applies to an audience (drives the matrix UI). */
export function appliesTo(audience: FeatureAudience, feature: FeatureKey): boolean {
  return (FEATURE_HREFS[audience][feature]?.length ?? 0) > 0;
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
