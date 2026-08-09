import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isOrgMember, listMyOrganizations } from "@/lib/organizations/organizations";

/**
 * Resolve the user's ACTIVE org id for query scoping (app layer). RLS can't read a
 * cookie, so scoping to the account the user switched to happens HERE.
 *
 * Uses the SERVICE-ROLE client for the membership/org lookups: we already have a
 * trusted, authenticated `userId`, and we only ever read that user's own rows.
 * Going through the RLS-bound client here was a bug — if RLS hid the user's
 * memberships the cookie check failed and we fell back to the wrong (first) org,
 * leaking one account's data into another.
 *
 * The `_supabase` param is kept for call-site compatibility but intentionally
 * unused — resolution must not depend on the caller's RLS context.
 */
export async function getActiveOrgId(_supabase: unknown, userId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  const jar = await cookies();
  const cookieOrg = jar.get("active_org")?.value ?? null;
  if (cookieOrg && (await isOrgMember(admin, userId, cookieOrg))) {
    return cookieOrg;
  }
  const orgs = await listMyOrganizations(admin, userId);
  return orgs[0]?.id ?? null;
}
