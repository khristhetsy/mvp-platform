import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Profile } from "@/lib/supabase/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getOrganization, type Organization } from "@/lib/organizations/organizations";
import { getActiveOrgId } from "@/lib/organizations/active-org";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export type ActiveCompanyResult = {
  /** The company to render for the ACTIVE account, or null when the active
   *  account has none (e.g. a Deal Company, or a founder org not yet provisioned). */
  company: Company | null;
  /** The active organization, when the multi-account model applies to this user. */
  org: Organization | null;
  /** True when the active account is a Deal Company (spv) — no founder raise. */
  isDealCompany: boolean;
};

/**
 * Resolve the company for the user's ACTIVE account — the app-layer scoping that
 * makes switching accounts actually change what data is shown.
 *
 * Behavior by case:
 *  - Non-founder role, or no org model yet (pre-backfill): falls back to the
 *    legacy `ensureFounderCompanyForUser` so nothing regresses.
 *  - Active org is a Deal Company (spv): returns the company row scoped to that
 *    org (usually none) and `isDealCompany: true`. Never returns the founder's
 *    raise company, so a Deal Company shows no founder data.
 *  - Active org is a Founder org: returns the company scoped by `org_id`; if none
 *    is found (org_id not yet backfilled), falls back to the legacy resolver.
 *
 * This is the single choke point the 50+ founder pages resolve their company
 * through once they migrate off `ensureFounderCompanyForUser`. Migrate page by
 * page; each one gains active-account scoping the moment it switches to this.
 */
export async function getActiveCompanyForUser(profile: Profile): Promise<ActiveCompanyResult> {
  if (profile.role !== "founder") {
    const company = await ensureFounderCompanyForUser(profile);
    return { company, org: null, isDealCompany: false };
  }

  const supabase = await createServerSupabaseClient();
  const orgId = await getActiveOrgId(supabase, profile.id);
  if (!orgId) {
    // No org model for this user yet — preserve exact legacy behavior.
    const company = await ensureFounderCompanyForUser(profile);
    return { company, org: null, isDealCompany: false };
  }

  const admin = createServiceRoleClient();
  const org = await getOrganization(admin, orgId);
  const isDealCompany = org?.type === "spv";

  const { data: scoped } = await loose(admin)
    .from("companies")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (scoped) {
    return { company: scoped as Company, org, isDealCompany };
  }

  // A Deal Company legitimately has no founder company — return empty, never the
  // user's other (founder) company.
  if (isDealCompany) {
    return { company: null, org, isDealCompany: true };
  }

  // Founder org whose company predates the org_id backfill — legacy resolver.
  const company = await ensureFounderCompanyForUser(profile);
  return { company, org, isDealCompany: false };
}
