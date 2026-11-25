import { NextResponse } from "next/server";
import { founderPlanApiBlock } from "@/lib/subscriptions/founder-access";
import { requireApiProfile } from "@/lib/api/auth";
import { isFeatureEnabled, loadFeatureFlags, type FeatureFlagMap } from "@/lib/feature-controls";
import { checkFounderStageAccess } from "@/lib/founder-journey/stage-gate";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Company, Profile } from "@/lib/supabase/types";

export type TermSheetGate =
  | { error: NextResponse }
  | { profile: Profile; supabase: SupabaseClient<Database>; company: Company; flags: FeatureFlagMap };

/** Founder, Stage 2 (qualify), the feature switch on, and a resolved company. Shared by all term sheet routes. */
export async function gateTermSheetApi(): Promise<TermSheetGate> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) {
    return { error: auth.error ?? NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  const flags = await loadFeatureFlags(auth.supabase);
  if (!isFeatureEnabled(flags, "founder", "term_sheet_creator")) {
    return { error: NextResponse.json({ error: "This feature is not available." }, { status: 403 }) };
  }
  const planBlock = await founderPlanApiBlock(auth.profile.id);
  if (planBlock) return { error: planBlock };
  const access = await checkFounderStageAccess("qualify");
  if (!access.allowed) {
    return { error: NextResponse.json({ error: "The term sheet creator unlocks at Stage 2." }, { status: 403 }) };
  }
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return { error: NextResponse.json({ error: "Company not found." }, { status: 404 }) };
  return { profile: auth.profile, supabase: auth.supabase, company, flags };
}
