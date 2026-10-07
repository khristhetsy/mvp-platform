/**
 * Server side: gathers the live facts the iCapOS Assistant needs on every
 * question, so it stays current with no manual updates:
 *   - the menu this user actually sees (same rules as /api/feature-controls:
 *     founder 4-step nav toggle, Feature Controls hides, stage menu editor hides,
 *     admin permissions), with stage locks;
 *   - for founders, the current price list (pricing_sets, edited in Admin › Pricing)
 *     and their own plan, outreach limit, usage this period and reset date.
 *
 * Every part is best effort: if a lookup fails the assistant still answers,
 * just without that part.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMenuKnowledge, filterNavByPermission } from "@/lib/assistant/menu-knowledge";
import { disabledHrefsFor, loadFeatureFlags, type FeatureAudience, type FeatureFlagMap } from "@/lib/feature-controls";
import { founderCapPeriod, reachedInPeriod } from "@/lib/outreach/investor-cap";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { getFounderNavV2RolloutPct, getFounderStageMenuHidden } from "@/lib/settings/platform-settings";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { PLAN_LABELS, type PlanType } from "@/lib/subscriptions/plans";
import { priceLabel, priceSublabel, type PricingCatalog } from "@/lib/subscriptions/pricing-catalog";
import { loadPricing } from "@/lib/subscriptions/pricing-server";
import { formatShortDay } from "@/lib/outreach/outreach-schedule";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database, Profile } from "@/lib/supabase/types";
import {
  getAdminWorkspaceNavSections,
  getFounderWorkspaceNavSections,
  getInvestorWorkspaceNavSections,
  type WorkspaceNavSection,
} from "@/lib/workspace-nav";

type Db = SupabaseClient<Database>;

/** Same bucket as /api/feature-controls, so the assistant sees the founder's real menu. */
function navBucket(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100;
}

async function founderUsesNavV2(flags: FeatureFlagMap, profileId: string): Promise<boolean> {
  const row = flags["founder:nav_v2"];
  if (row === true) return true;
  if (row === false) return false;
  const pct = await getFounderNavV2RolloutPct();
  return pct > 0 ? navBucket(profileId) < pct : process.env.NEXT_PUBLIC_FOUNDER_NAV_V2 === "on";
}

const SELF_SERVE: PlanType[] = ["founder_basic", "founder_professional"];

function planPrice(catalog: PricingCatalog, plan: PlanType): string {
  const label = priceLabel(catalog, plan);
  const sub = priceSublabel(catalog, plan);
  if (!sub) return label;
  return sub.startsWith("/") ? `${label}${sub}` : `${label} (${sub})`;
}

function capText(cap: number | null): string {
  if (cap === null) return "no limit";
  if (cap === 0) return "none";
  return `up to ${cap} investors per 30 day period`;
}

/** Price list and the founder's own plan, limit and usage. */
async function founderPlanKnowledge(profileId: string, companyId: string | null): Promise<string> {
  const lines: string[] = [];
  const catalog = await loadPricing();
  const offered = [...SELF_SERVE, "founder_managed_ir" as PlanType]
    .map((p) => `${PLAN_LABELS[p]} ${planPrice(catalog, p)}`)
    .join("; ");
  lines.push(`Founder plans and prices (live from the price list): ${offered}. There is no free plan for new founders. Plans are changed in Settings › Billing & subscription (/founder/settings/billing).`);
  for (const p of SELF_SERVE) {
    const e = founderEntitlements(p);
    lines.push(
      `- ${PLAN_LABELS[p]}: investor outreach ${capText(e.investorCap)}; brokered intro requests ${e.canBrokerIntros ? "yes" : "no"}; monthly presentation slot ${e.canPresentMonthly ? "yes" : "no"}.`,
    );
  }

  const plan = (await getUserPlan(profileId)) as PlanType | null;
  const ent = founderEntitlements(plan);
  const planName = plan ? PLAN_LABELS[plan] ?? plan : "no active plan";
  lines.push(`This founder's plan: ${planName}. Outreach limit: ${capText(ent.investorCap)}. Can send outreach: ${ent.canDistribute ? "yes" : "no"}. Brokered intros: ${ent.canBrokerIntros ? "yes" : "no"}.`);

  if (companyId && ent.investorCap !== null && ent.investorCap > 0) {
    const db = createServiceRoleClient();
    const period = await founderCapPeriod(db, profileId);
    const used = (await reachedInPeriod(db, companyId, period.start)).size;
    const left = Math.max(0, ent.investorCap - used);
    const resets = `${formatShortDay(period.end)} (Pacific time)`;
    lines.push(`Outreach this period: ${used} of ${ent.investorCap} investors reached, ${left} left; the allowance resets on ${resets}. Founders can see all their matches, but outreach and intro requests cannot go past the limit.`);
  }
  return lines.join("\n");
}

export async function loadAssistantKnowledge(input: {
  profile: Profile;
  supabase: Db;
  currentPath?: string | null;
  companyId?: string | null;
}): Promise<string> {
  const { profile } = input;
  const role = profile.role;
  const audience: FeatureAudience =
    role === "investor" ? "investor" : role === "admin" || role === "analyst" ? "admin" : "founder";
  const parts: string[] = [];

  try {
    const service = createServiceRoleClient();
    const flags = await loadFeatureFlags(service);
    const hidden = new Set(disabledHrefsFor(flags, audience));
    let sections: WorkspaceNavSection[];
    let journeyStage: string | null = null;

    if (audience === "founder") {
      sections = getFounderWorkspaceNavSections(await founderUsesNavV2(flags, profile.id));
      for (const href of await getFounderStageMenuHidden()) hidden.add(href);
      const { data } = await service.from("profiles").select("journey_stage").eq("id", profile.id).maybeSingle();
      journeyStage = ((data as { journey_stage?: string | null } | null)?.journey_stage ?? null) || null;
    } else if (audience === "investor") {
      sections = getInvestorWorkspaceNavSections();
    } else {
      const effective = await getEffectivePermissions(service, profile.id, profile);
      sections = filterNavByPermission(getAdminWorkspaceNavSections(), effective.permissions, effective.isSuperAdmin);
    }

    parts.push(
      buildMenuKnowledge({ workspace: audience, sections, hidden, currentPath: input.currentPath, journeyStage }),
    );
    if (journeyStage) parts.push(`This founder's current stage: ${journeyStage}.`);
  } catch {
    // Menu is a help, not a requirement: answer without it.
  }

  if (audience === "founder") {
    try {
      parts.push(await founderPlanKnowledge(profile.id, input.companyId ?? null));
    } catch {
      // Same: skip plan facts if pricing or usage can't be read.
    }
  }

  return parts.join("\n\n");
}
