import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

// Pages and routes call supabase.auth.getUser() and getSession() with no argument, which
// needs a stored session. A client built from an access token has none, so answer those
// two calls from the token. Same approach as the mobile routes (api/mobile/_bearer.ts).
function withTokenAuth<C extends SupabaseClient>(client: C, token: string, user: unknown): C {
  const auth = new Proxy(client.auth, {
    get(target, prop) {
      if (prop === "getUser") return (jwt?: string) => target.getUser(jwt ?? token);
      if (prop === "getSession")
        return async () => ({ data: { session: { access_token: token, refresh_token: "", token_type: "bearer", expires_in: 3600, user } }, error: null });
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "auth") return auth;
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

/** A Supabase client that acts as the user the access token belongs to. RLS applies as that user. */
export function createTokenClient(accessToken: string, user: unknown): SupabaseClient {
  const { url, anonKey } = getSupabaseBrowserEnv();
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return withTokenAuth(client, accessToken, user);
}
