import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import type { Company, Database, Profile } from "@/lib/supabase/types";

export type FounderInvestorCrmApiContext = {
  supabase: SupabaseClient<Database>;
  profile: Profile;
  company: Company;
};

export type FounderInvestorCrmApiResult =
  | { error: NextResponse }
  | FounderInvestorCrmApiContext;

export function isFounderInvestorCrmApiError(
  result: FounderInvestorCrmApiResult,
): result is { error: NextResponse } {
  return "error" in result;
}

export async function requireFounderInvestorCrmApi(): Promise<FounderInvestorCrmApiResult> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth && auth.error) {
    return { error: auth.error };
  }

  const access = await getFounderFeatureAccess("investor_access");
  if (!access.allowed) {
    return {
      error: NextResponse.json(
        { error: access.reason ?? "Upgrade required for investor CRM.", code: "subscription_required" },
        { status: 403 },
      ),
    };
  }

  // Scope the CRM to the ACTIVE account. A Deal Company has no founder company,
  // so its CRM reads empty and writes are refused here (as they are pre-onboarding).
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) {
    return {
      error: NextResponse.json({ error: "Company profile required." }, { status: 400 }),
    };
  }

  return { ...auth, company };
}
