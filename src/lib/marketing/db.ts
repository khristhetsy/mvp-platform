/**
 * Returns the Supabase client cast to `any` so we can query the new
 * marketing tables before the generated Database types are updated
 * (run `supabase gen types` after applying migration 0072).
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function marketingDb(): Promise<any> {
  return createServerSupabaseClient();
}
