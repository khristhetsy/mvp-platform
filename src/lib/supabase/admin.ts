import { createClient } from "@supabase/supabase-js";
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
