// Shared by the /api/mobile routes: signs the request in from the phone's
// Supabase access token (Authorization: Bearer) and runs a function as that
// founder. It reuses runAsActingUser, so createServerSupabaseClient() and every
// helper built on it (getActiveCompanyForUser, crrFor and so on) act as the
// founder without a cookie. New file, nothing existing is changed.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { runAsActingUser } from "@/lib/scheduled-emails/acting-user";
import type { Profile } from "@/lib/supabase/types";

// The website's own handlers call supabase.auth.getUser() and getSession() with no argument, which needs a
// stored session. The phone sends only an access token, so answer those two calls from the token.
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

export async function withBearerFounder<T>(
  req: Request,
  fn: (ctx: { profile: Profile; email: string; client: SupabaseClient }) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; status: number }> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401 };
  const { url, anonKey } = getSupabaseBrowserEnv();
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error } = await client.auth.getUser(token);
  if (error || !userData.user) return { ok: false, status: 401 };
  const { data: profile } = await client.from("profiles").select("*").eq("id", userData.user.id).single();
  if (!profile || (profile as Profile).role !== "founder") return { ok: false, status: 403 };
  const scoped = withTokenAuth(client, token, userData.user);
  const value = await runAsActingUser({ userId: userData.user.id, client: scoped }, () =>
    fn({ profile: profile as Profile, email: userData.user.email ?? "", client: scoped }),
  );
  return { ok: true, value };
}
