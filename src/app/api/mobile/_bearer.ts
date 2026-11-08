// Shared by the /api/mobile routes: signs the request in from the phone's
// Supabase access token (Authorization: Bearer) and runs a function as that
// founder. It reuses runAsActingUser, so createServerSupabaseClient() and every
// helper built on it (getActiveCompanyForUser, crrFor and so on) act as the
// founder without a cookie. New file, nothing existing is changed.
import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { runAsActingUser } from "@/lib/scheduled-emails/acting-user";
import type { Profile } from "@/lib/supabase/types";

// The website's own handlers call supabase.auth.getUser() and getSession() with no argument, which needs a
// stored session. The phone sends only an access token, so answer those two calls from the token.
export function withTokenAuth<C extends SupabaseClient>(client: C, token: string, user: unknown): C {
  const auth = new Proxy(client.auth, {
    get(target, prop) {
      // The token was verified once at the start of this request (openBearerSession), so a getUser() for that same
      // token is answered from that result instead of calling Supabase again. Any other token still goes to Supabase.
      if (prop === "getUser")
        return async (jwt?: string) => {
          if (jwt === undefined || jwt === token) return { data: { user }, error: null };
          return target.getUser(jwt);
        };
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

export type BearerSession = { token: string; user: User; profile: Profile; client: SupabaseClient };
type BearerFn<T> = (ctx: { profile: Profile; email: string; client: SupabaseClient }) => Promise<T>;

/** Verifies the phone's token once and loads the profile once. Role checks are left to the caller. */
export async function openBearerSession(
  req: Request,
): Promise<{ ok: true; session: BearerSession } | { ok: false; status: number }> {
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
  if (!profile) return { ok: false, status: 403 };
  return { ok: true, session: { token, user: userData.user, profile: profile as Profile, client } };
}

/** Runs fn as the person in an opened session, with the website's helpers acting as them. */
export async function runInBearerSession<T>(s: BearerSession, fn: BearerFn<T>): Promise<T> {
  const scoped = withTokenAuth(s.client, s.token, s.user);
  return runAsActingUser({ userId: s.user.id, client: scoped }, () =>
    fn({ profile: s.profile, email: s.user.email ?? "", client: scoped }),
  );
}

/** Opens a session and runs fn only when the profile's role is one of the allowed roles, else 403. */
export async function withBearerRole<T>(
  req: Request,
  roles: string[],
  fn: BearerFn<T>,
): Promise<{ ok: true; value: T } | { ok: false; status: number }> {
  const opened = await openBearerSession(req);
  if (!opened.ok) return opened;
  if (!roles.includes(opened.session.profile.role)) return { ok: false, status: 403 };
  return { ok: true, value: await runInBearerSession(opened.session, fn) };
}

export function withBearerFounder<T>(req: Request, fn: BearerFn<T>) {
  return withBearerRole(req, ["founder"], fn);
}
