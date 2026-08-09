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

/** Read the org_id column off a company row even when the generated type omits it. */
function orgIdOf(company: Company | null): string | null {
  return (company as { org_id?: string | null } | null)?.org_id ?? null;
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
 * The critical safety rule: the user's PRIMARY founder company (the one owned by
 * `founder_id`) is returned ONLY when the active org is that company's own org.
 * For any other active account (a Deal Company, or a second org) we return solely
 * a company explicitly scoped to that org's `org_id`, and NEVER fall back to the
 * primary company. That fallback was the leak — a Deal Company was inheriting the
 * founder's raise data.
 */
export async function getActiveCompanyForUser(profile: Profile): Promise<ActiveCompanyResult> {
  if (profile.role !== "founder") {
    const company = await ensureFounderCompanyForUser(profile);
    return { company, org: null, isDealCompany: false };
  }

  const supabase = await createServerSupabaseClient();
  const orgId = await getActiveOrgId(supabase, profile.id);

  // The user's primary founder company (resolved by founder_id). Its org_id marks
  // the user's primary founder account.
  const primary = await ensureFounderCompanyForUser(profile);

  if (!orgId) {
    // No org model for this user yet — preserve exact legacy behavior.
    return { company: primary, org: null, isDealCompany: false };
  }

  const admin = createServiceRoleClient();
  const org = await getOrganization(admin, orgId);
  const isDealCompany = org?.type === "spv";

  // Active org IS the primary company's org → show the primary company.
  if (primary && orgIdOf(primary) === orgId) {
    return { company: primary, org, isDealCompany };
  }

  // Active org is a DIFFERENT account. Only ever show a company explicitly scoped
  // to it — never the primary founder company.
  const { data: scoped } = await loose(admin)
    .from("companies")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { company: (scoped as Company) ?? null, org, isDealCompany };
}
