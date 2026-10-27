import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "./env";
import type { Database } from "./types";
import { actingUserClient } from "@/lib/scheduled-emails/acting-user";

/** The real signed in session, read from the cookie. Staff identity checks use this one. */
export async function createCookieSupabaseClient() {
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

export async function createServerSupabaseClient() {
  // A scheduled email being sent runs as the person who scheduled it (see
  // scheduled-emails/acting-user). Everywhere else this reads the cookie session.
  const acting = actingUserClient();
  if (acting) return acting as ReturnType<typeof createServerClient<Database>>;

  // Staff acting as a founder (central switch, see admin/acting-central). Off unless
  // ACT_AS_FOUNDER_CENTRAL=1; the check is inline so nothing extra loads when it is off.
  if (process.env.ACT_AS_FOUNDER_CENTRAL === "1") {
    const { resolveCentralActingClient } = await import("@/lib/admin/acting-central");
    const founderClient = await resolveCentralActingClient();
    if (founderClient) return founderClient as ReturnType<typeof createServerClient<Database>>;
  }

  return createCookieSupabaseClient();
}
