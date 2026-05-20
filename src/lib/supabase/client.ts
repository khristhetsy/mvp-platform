import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "./env";
import type { Database } from "./types";

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();

  return createBrowserClient<Database>(url, anonKey);
}
