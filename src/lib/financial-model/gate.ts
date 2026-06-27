import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { checkFounderStageAccess } from "@/lib/founder-journey/stage-gate";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Company, Profile } from "@/lib/supabase/types";

export type FinancialModelGate =
  | { error: NextResponse }
  | { profile: Profile; supabase: SupabaseClient<Database>; company: Company };

/** Founder + Stage 2 (qualify) + resolved company. Shared by financial-model routes. */
export async function gateFinancialModelApi(): Promise<FinancialModelGate> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) {
    return { error: auth.error ?? NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  const flags = await loadFeatureFlags(auth.supabase);
  if (!isFeatureEnabled(flags, "founder", "financial_model")) {
    return { error: NextResponse.json({ error: "This feature is not available." }, { status: 403 }) };
  }
  const access = await checkFounderStageAccess("qualify");
  if (!access.allowed) {
    return { error: NextResponse.json({ error: "The financial model unlocks at Stage 2." }, { status: 403 }) };
  }
  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return { error: NextResponse.json({ error: "Company not found." }, { status: 404 }) };
  return { profile: auth.profile, supabase: auth.supabase, company };
}
