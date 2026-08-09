import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { listMyOrganizations } from "@/lib/organizations/organizations";
import { AccountSwitcher } from "@/components/account/AccountSwitcher";

// Server wrapper that feeds the client AccountSwitcher: the user's orgs, the
// validated active-org cookie, and whether they're on Professional (for the
// Add-a-company gate). Renders nothing until the org model exists for this user
// (pre-backfill), so it never appears empty or breaks the header.
export async function AccountSwitcherServer() {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;

  const supabase = await createServerSupabaseClient();
  const orgs = await listMyOrganizations(supabase, profile.id).catch(() => []);
  if (orgs.length === 0) return null;

  const jar = await cookies();
  const activeOrgId = jar.get("active_org")?.value ?? null;
  const plan = await getUserPlan(profile.id).catch(() => null);

  return (
    <AccountSwitcher orgs={orgs} activeOrgId={activeOrgId} isProfessional={plan === "founder_professional"} />
  );
}
