import { cookies } from "next/headers";
import { isOrgMember, listMyOrganizations } from "@/lib/organizations/organizations";

/**
 * Resolve the user's ACTIVE org for query scoping (app layer). RLS can't read a
 * cookie, so `is_member(org_id)` alone would show data across ALL a user's orgs;
 * scoping to the one they switched to happens HERE — reads add `.eq("org_id",
 * activeOrgId)`. Reads the validated active-org cookie, re-checks membership
 * (never trusts the cookie), and falls back to the user's first org.
 *
 * SAFE / INERT until callers start filtering by the returned id — adding this
 * helper changes no behavior on its own.
 */
export async function getActiveOrgId(supabase: unknown, userId: string): Promise<string | null> {
  const jar = await cookies();
  const cookieOrg = jar.get("active_org")?.value ?? null;
  if (cookieOrg && (await isOrgMember(supabase, userId, cookieOrg))) {
    return cookieOrg;
  }
  const orgs = await listMyOrganizations(supabase, userId);
  return orgs[0]?.id ?? null;
}
