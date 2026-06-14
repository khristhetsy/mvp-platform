/**
 * Returns a Supabase service-role client for marketing table access.
 * Marketing tables are not yet in the generated types — cast to any here
 * so all downstream .from("marketing_*") calls resolve without `never`.
 * Re-run `supabase gen types typescript` to remove this cast.
 * Access control is enforced at the API layer via requireRole(["admin"]).
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MarketingClient = SupabaseClient<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function marketingDb(): MarketingClient {
  return createServiceRoleClient() as unknown as MarketingClient;
}
