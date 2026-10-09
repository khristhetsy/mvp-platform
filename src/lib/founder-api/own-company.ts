import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { userHasCompanyAccess } from "@/lib/onboarding/ensure-founder-setup";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import type { Profile } from "@/lib/supabase/types";

/**
 * The founder's own company for founder routes that act on their own company (listing, report shares). The company id comes from
 * the founder's active account, never from the request body, and membership is
 * verified the same way the document upload route verifies it.
 */
export async function resolveFounderOwnCompany(): Promise<
  { profile: Profile; companyId: string } | { error: NextResponse }
> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) {
    return { error: auth.error ?? NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) {
    return { error: NextResponse.json({ error: "Complete your company profile first." }, { status: 400 }) };
  }
  if (!(await userHasCompanyAccess(auth.profile.id, company.id))) {
    return { error: NextResponse.json({ error: "You don't have access to this company." }, { status: 403 }) };
  }
  return { profile: auth.profile, companyId: company.id };
}
