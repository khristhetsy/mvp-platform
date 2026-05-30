import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { getFounderFeatureAccess } from "@/lib/subscriptions/founder-access";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
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

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return {
      error: NextResponse.json({ error: "Company profile required." }, { status: 400 }),
    };
  }

  return { ...auth, company };
}
