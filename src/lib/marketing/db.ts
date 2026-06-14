/**
 * Returns the Supabase client cast to `any` so we can query the new
 * marketing tables before the generated Database types are updated
 * (run `supabase gen types` after applying migration 0072).
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";

// Use service role to bypass RLS on marketing tables.
// Access control is enforced at the API layer via requireRole(["admin"]).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function marketingDb(): Promise<any> {
  return createServiceRoleClient();
}
