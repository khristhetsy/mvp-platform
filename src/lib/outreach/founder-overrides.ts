import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import type { PlanType } from "@/lib/subscriptions/plans";
import {
  getInvestorMatchConfig,
  getOutreachMessage,
  getAutomationConfig,
  type InvestorMatchConfig,
  type OutreachMessage,
  type AutomationConfig,
  type SendCadence,
} from "@/lib/settings/platform-settings";

/**
 * Per-founder outreach qualification overrides + the resolver that merges the
 * global platform defaults with a founder's overrides into one EFFECTIVE config.
 *
 * Overrides are sparse: a row stores only the sections a founder customized; every
 * other section falls through to the global default. This keeps "change the global
 * default and every non-customized founder updates" working automatically.
 */

/** The automation fields a founder may override (cap is an explicit number that
 *  wins over the plan-derived default). */
export type FounderAutomationOverride = {
  capOverride?: number | null;
  startDate?: string | null;
  cadence?: SendCadence;
  pause?: { enabled: boolean; until: string | null };
};

export type FounderOverride = {
  match?: Partial<InvestorMatchConfig>;
  automation?: FounderAutomationOverride;
  message?: Partial<OutreachMessage>;
};

export type EffectiveOutreachConfig = {
  match: InvestorMatchConfig;
  message: OutreachMessage;
  /** Resolved monthly send cap (per-founder override → else plan-derived). */
  monthlyCap: number;
  startDate: string | null;
  cadence: SendCadence;
  pause: { enabled: boolean; until: string | null };
  planType: PlanType | null;
  /** Whether the founder has a custom value in each section (for Inherited/Custom badges). */
  customized: { match: boolean; automation: boolean; message: boolean };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

/** The plan-derived monthly cap before any per-founder override. */
export function planMonthlyCap(plan: PlanType | null, automation: AutomationConfig): number {
  if (plan === "founder_professional") return automation.monthlyByPlan.professional;
  // basic, trial, and anything else fall to the basic tier cap.
  return automation.monthlyByPlan.basic;
}

/** Read a founder's raw override row (null when they've never customized). */
export async function getFounderOverride(companyId: string): Promise<FounderOverride | null> {
  try {
    const { data } = await db()
      .from("founder_outreach_overrides")
      .select("overrides")
      .eq("company_id", companyId)
      .maybeSingle();
    const o = (data as { overrides?: FounderOverride } | null)?.overrides;
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

/** Write (or clear) a founder's override. An empty object deletes the row so the
 *  founder cleanly reverts to global defaults. */
export async function setFounderOverride(
  companyId: string,
  override: FounderOverride | null,
  updatedBy: string | null,
): Promise<boolean> {
  try {
    const isEmpty =
      !override ||
      ((!override.match || Object.keys(override.match).length === 0) &&
        (!override.automation || Object.keys(override.automation).length === 0) &&
        (!override.message || Object.keys(override.message).length === 0));
    if (isEmpty) {
      const { error } = await db().from("founder_outreach_overrides").delete().eq("company_id", companyId);
      return !error;
    }
    const { error } = await db()
      .from("founder_outreach_overrides")
      .upsert(
        { company_id: companyId, overrides: override, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "company_id" },
      );
    return !error;
  } catch {
    return false;
  }
}

function hasKeys(o: object | undefined | null): boolean {
  return !!o && Object.keys(o).length > 0;
}

/**
 * Resolve the EFFECTIVE outreach config for one founder: global defaults + plan
 * cap + per-founder override. Match/industry stays locked-required regardless.
 */
/** The global (identical-for-everyone) config rows. Load once and reuse across
 *  many founders instead of re-fetching them per campaign. */
export type OutreachGlobals = {
  match: InvestorMatchConfig;
  message: OutreachMessage;
  automation: AutomationConfig;
};

export async function loadOutreachGlobals(): Promise<OutreachGlobals> {
  const [match, message, automation] = await Promise.all([
    getInvestorMatchConfig(),
    getOutreachMessage(),
    getAutomationConfig(),
  ]);
  return { match, message, automation };
}

export async function resolveFounderOutreachConfig(
  company: { id: string; founder_id: string },
  globals?: OutreachGlobals,
): Promise<EffectiveOutreachConfig> {
  // The three global rows are identical for every founder — accept them
  // pre-loaded so a caller iterating many campaigns fetches them just once.
  const g = globals ?? (await loadOutreachGlobals());
  const [override, plan] = await Promise.all([
    getFounderOverride(company.id),
    getUserPlan(company.founder_id).catch(() => null),
  ]);
  const globalMatch = g.match;
  const globalMessage = g.message;
  const automation = g.automation;

  const om = override?.match;
  const match: InvestorMatchConfig = {
    ...globalMatch,
    ...(om ?? {}),
    requiredFields: { ...globalMatch.requiredFields, ...(om?.requiredFields ?? {}), industry: true },
    weights: { ...globalMatch.weights, ...(om?.weights ?? {}) },
  };

  const message: OutreachMessage = { ...globalMessage, ...(override?.message ?? {}) };

  const oa = override?.automation;
  const monthlyCap =
    oa && typeof oa.capOverride === "number" ? oa.capOverride : planMonthlyCap(plan, automation);
  const startDate = oa && oa.startDate !== undefined ? oa.startDate : automation.startDate;
  const cadence = oa?.cadence ?? automation.cadence;
  const pause = oa?.pause ?? automation.pause;

  return {
    match,
    message,
    monthlyCap,
    startDate,
    cadence,
    pause,
    planType: plan,
    customized: { match: hasKeys(om), automation: hasKeys(oa), message: hasKeys(override?.message) },
  };
}
