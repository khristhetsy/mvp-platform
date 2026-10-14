// The company page's "At a glance" numbers, shaped for email. Pure: it takes the
// figures the company page already loads (getAdminCompanyWorkspace) and returns
// plain text, so an email shows exactly what the founder's page shows.
//
// Two outputs:
//  - glanceFields(): rows for the branded template "Founder data" panel.
//  - glanceVars(): {{merge_tags}} a per-founder send fills in.

import { OUTREACH_GATE } from "@/lib/crr/weight-sets";

/** The slice of AdminCompanyWorkspaceData this file reads (structurally compatible). */
export type GlanceSource = {
  readiness: {
    latestScore: number | null;
    onboardingPercent: number;
    milestoneLabel: string;
    remediation: { active: number; completed: number; total: number; highPriorityOpen: number };
  };
  investable: { totalScore: number; effectiveScore: number | null } | null;
  investorActivity: { interests: number; introRequests: number };
  compliance: { openCount: number; totalCount: number; criticalCount: number };
};

export type GlanceField = { key: string; label: string; value: string; /** This founder's current text, for display. */ shown?: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Capital Readiness Rating the page shows: the admin override when set, else the engine score. */
export function glanceScore(src: GlanceSource): number | null {
  return src.investable ? (src.investable.effectiveScore ?? src.investable.totalScore) : null;
}

export function glanceVars(src: GlanceSource): Record<string, string> {
  const crr = glanceScore(src);
  const r = src.readiness;
  const rem = r.remediation;
  const a = src.investorActivity;
  const c = src.compliance;
  return {
    prep_score: r.latestScore != null ? String(r.latestScore) : "Not yet run",
    prep_onboarding: `${r.onboardingPercent}%`,
    prep_level: r.milestoneLabel,
    crr_score: crr != null ? `${crr}/100` : "Not yet scored",
    crr_gate: String(OUTREACH_GATE),
    crr_status:
      crr == null
        ? `Outreach unlocks at ${OUTREACH_GATE}`
        : crr >= OUTREACH_GATE
          ? "Outreach gate cleared"
          : `${OUTREACH_GATE - crr} points to the ${OUTREACH_GATE} outreach gate`,
    remediation_open: String(rem.active),
    remediation_detail: `${rem.completed} closed of ${rem.total}`,
    remediation_priority: rem.highPriorityOpen > 0 ? `${plural(rem.highPriorityOpen, "high priority item")} still open` : "None are high priority",
    investor_interests: String(a.interests),
    investor_detail: plural(a.introRequests, "intro request"),
    investor_status: a.interests === 0 ? "No investor has seen this company yet" : `${plural(a.interests, "investor")} interested`,
    compliance_open: String(c.openCount),
    compliance_detail: `${c.totalCount - c.openCount} resolved of ${c.totalCount}`,
    compliance_status: c.criticalCount > 0 ? `${c.criticalCount} critical` : c.openCount === 0 ? "Nothing outstanding" : "None are critical",
  };
}

/**
 * Rows for the Founder data panel, in the order the company page lists its cards.
 * `value` is what "+ Insert" puts in the email: merge tags, so a send to many
 * founders fills each one's own numbers. `shown` is this founder's current text.
 */
export function glanceFields(src: GlanceSource): GlanceField[] {
  const v = glanceVars(src);
  const row = (key: string, label: string, tagged: string): GlanceField => ({ key, label, value: tagged, shown: fillGlance(tagged, v) });
  return [
    row("prep_score", "Preparation complete", "Preparation complete: {{prep_score}} (onboarding {{prep_onboarding}}, {{prep_level}})"),
    row("crr_score", "Capital Readiness Rating", "Capital Readiness Rating: {{crr_score}} (gate {{crr_gate}}). {{crr_status}}."),
    row("remediation_open", "Open remediation", "Open remediation: {{remediation_open}} ({{remediation_detail}}). {{remediation_priority}}."),
    row("investor_interests", "Investor interests", "Investor interests: {{investor_interests}} ({{investor_detail}}). {{investor_status}}."),
    row("compliance_open", "Open compliance", "Open compliance: {{compliance_open}} ({{compliance_detail}}). {{compliance_status}}."),
  ];
}

/** Fill {{tag}} placeholders from `vars`; tags it does not know are left as written. */
export function fillGlance(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
