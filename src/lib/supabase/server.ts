import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "./env";
import type { Database } from "./types";
import { actingUserClient } from "@/lib/scheduled-emails/acting-user";

export async function createServerSupabaseClient() {
  // A scheduled email being sent runs as the person who scheduled it (see
  // scheduled-emails/acting-user). Everywhere else this reads the cookie session.
  const acting = actingUserClient();
  if (acting) return acting as ReturnType<typeof createServerClient<Database>>;

  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseBrowserEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot set cookies. Middleware refreshes auth sessions.
        }
      },
    },
  });
}
