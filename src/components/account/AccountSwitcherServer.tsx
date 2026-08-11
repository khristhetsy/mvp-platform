import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { listMyOrganizations } from "@/lib/organizations/organizations";
import { AccountSwitcher } from "@/components/account/AccountSwitcher";

// Server wrapper that feeds the client AccountSwitcher: the user's orgs, the
// validated active-org cookie, and whether adding a company is granted (a
// super-admin-controlled entitlement on any of the user's orgs). Renders nothing
// until the org model exists for this user, so it never appears empty.
export async function AccountSwitcherServer() {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;

  const supabase = await createServerSupabaseClient();
  const orgs = await listMyOrganizations(supabase, profile.id).catch(() => []);
  if (orgs.length === 0) return null;

  const jar = await cookies();
  const activeOrgId = jar.get("active_org")?.value ?? null;
  const canAddCompanies = orgs.some((o) => o.can_add_companies === true);

  return (
    <AccountSwitcher orgs={orgs} activeOrgId={activeOrgId} canAddCompanies={canAddCompanies} />
  );
}
