// Same as withBearerFounder (see _bearer.ts), for the iCapOS app's investor workspace: signs the request in
// from the phone's Supabase access token and runs a function as that investor. Founders get 403 here, and
// investors get 403 from withBearerFounder, so the two sides never see each other's data. New file.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { runAsActingUser } from "@/lib/scheduled-emails/acting-user";
import type { Profile } from "@/lib/supabase/types";
import { withTokenAuth } from "./_bearer";

export async function withBearerInvestor<T>(
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
  if (!profile || (profile as Profile).role !== "investor") return { ok: false, status: 403 };
  const scoped = withTokenAuth(client, token, userData.user);
  const value = await runAsActingUser({ userId: userData.user.id, client: scoped }, () =>
    fn({ profile: profile as Profile, email: userData.user.email ?? "", client: scoped }),
  );
  return { ok: true, value };
}
