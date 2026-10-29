/**
 * What the public website and signup need to know about the founder IR agent:
 * which plans include it (the same table admin edits in Feature Controls) and
 * which live agent serves as the website demo. Server only; every read is
 * defensive so a missing table never breaks the pricing page.
 */
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { isFeatureEnabled, loadFeatureFlags } from "@/lib/feature-controls";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { agentPath } from "./slug";
import { IR_AGENT_FEATURE_KEY } from "./store";

/** The feature line as shown on plan cards. One wording everywhere. */
export const AGENT_FEATURE_LINE = "Investor Relations Agent, prospecting investors 24/7";

export const DEMO_SETTING_KEY = "ir_agent_demo";

/** Pricing tier name → plan type, for the public page. */
export const TIER_PLAN: Record<string, string> = {
  Free: "founder_free",
  Basic: "founder_basic",
  Professional: "founder_professional",
  Premium: "founder_premium",
  "SPV Program": "founder_managed_ir",
};

/** Plans that include the agent. Empty when the master switch is off, so the website says nothing. */
export async function getAgentPlanSet(): Promise<Set<string>> {
  try {
    const flags = await loadFeatureFlags(createServiceRoleClient());
    if (!isFeatureEnabled(flags, "founder", IR_AGENT_FEATURE_KEY)) return new Set();
    const { data } = await serviceRoleClientUntyped().from("ir_agent_plan_access").select("plan_key");
    return new Set(((data ?? []) as Array<{ plan_key: string }>).map((r) => r.plan_key));
  } catch {
    return new Set();
  }
}

export type DemoAgent = { path: string; companyName: string; displayName: string };

/** The live agent admin picked as the website demo, or null. */
export async function getDemoAgent(): Promise<DemoAgent | null> {
  try {
    const db = serviceRoleClientUntyped();
    const { data: setting } = await db.from("platform_settings").select("value").eq("key", DEMO_SETTING_KEY).maybeSingle();
    const slug = (setting as { value?: { slug?: string } } | null)?.value?.slug;
    if (!slug) return null;
    const { data } = await db.from("ir_agents").select("company_slug, ending, company_name, display_name").eq("company_slug", slug).eq("status", "live").maybeSingle();
    const a = data as { company_slug: string; ending: string; company_name: string; display_name: string } | null;
    return a ? { path: `${agentPath(a.company_slug, a.ending)}?src=pricing`, companyName: a.company_name, displayName: a.display_name } : null;
  } catch {
    return null;
  }
}

export async function setDemoAgent(slug: string | null, updatedBy: string | null): Promise<boolean> {
  const { error } = await serviceRoleClientUntyped()
    .from("platform_settings")
    .upsert({ key: DEMO_SETTING_KEY, value: { slug }, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return !error;
}
