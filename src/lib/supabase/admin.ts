import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceEnv } from "./env";
import type { Database } from "./types";

export function createServiceRoleClient() {
  const { url, serviceRoleKey } = getSupabaseServiceEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Service-role client for tables that are not yet in the generated Supabase
 * types (marketing_*, mkt_*, aeo_*, playbook_*, …). Single canonical home for the
 * `as unknown as SupabaseClient` cast so it is written once, not per-module.
 * Remove usages as those tables get added to `types.ts` via `npm run db:types`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serviceRoleClientUntyped(): SupabaseClient<any> {
  return createServiceRoleClient() as unknown as SupabaseClient;
}
