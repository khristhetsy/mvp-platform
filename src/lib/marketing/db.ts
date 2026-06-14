/**
 * Returns the Supabase service-role client for marketing table access.
 * Marketing tables are not yet in generated types — call sites use
 * `as unknown as T` casts until `supabase gen types` is re-run.
 * Access control is enforced at the API layer via requireRole(["admin"]).
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export async function marketingDb(): Promise<ServiceRoleClient> {
  return createServiceRoleClient();
}
