import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";
import { createTokenClient } from "@/lib/supabase/token-client";
import { ACT_COOKIE, getActingContext } from "@/lib/admin/act-on-behalf";
import { VERDICT_TTL_MS, ZONE_HEADER, centralActingApplies, effectiveZone, isCentralActingEnabled, sessionExpiryMs } from "@/lib/admin/acting-central-core";

/**
 * Central act on behalf. When a staff member has a valid acting session, this returns a
 * Supabase client that runs as the founder, so every founder page and route works with
 * no per page changes. RLS still applies, as the founder.
 *
 * Trust model: the acting decision is made by getActingContext(), which re-checks the
 * signed cookie, that the real signed in user is the staff member who started it, and
 * that they still may act on this founder. The result is reused for 30 seconds, keyed to
 * the cookie plus the staff member's own session cookies. Revoking access takes effect
 * within that window. Nothing here runs unless ACT_AS_FOUNDER_CENTRAL=1.
 */
type Verdict = { exp: number; client: unknown | null };
type FounderSession = { exp: number; accessToken: string; user: unknown };

const verdicts = new Map<string, Verdict>();
const founderSessions = new Map<string, FounderSession>();

function prune<V extends { exp: number }>(map: Map<string, V>, now: number) {
  if (map.size < 200) return;
  for (const [k, v] of map) if (v.exp <= now) map.delete(k);
}

/** A one time server side session for the founder (same method the scheduled email runner uses). */
async function founderSession(founderId: string): Promise<FounderSession | null> {
  const now = Date.now();
  const hit = founderSessions.get(founderId);
  if (hit && hit.exp > now) return hit;

  const admin = createServiceRoleClient();
  const { data: u } = await admin.auth.admin.getUserById(founderId);
  const email = u?.user?.email;
  if (!email) return null;
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (!tokenHash) return null;

  const { url, anonKey } = getSupabaseBrowserEnv();
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: v, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error || !v?.session) return null;

  const session: FounderSession = {
    accessToken: v.session.access_token,
    user: v.session.user,
    exp: sessionExpiryMs(v.session.expires_in, now),
  };
  founderSessions.set(founderId, session);
  prune(founderSessions, now);
  return session;
}

/** The client that runs as the founder, or null when no valid acting session applies to this request. */
export async function resolveCentralActingClient(): Promise<unknown | null> {
  if (!isCentralActingEnabled(process.env.ACT_AS_FOUNDER_CENTRAL)) return null;

  let store: Awaited<ReturnType<typeof cookies>>;
  try {
    store = await cookies();
  } catch {
    return null; // not inside a request (cron, scheduled sends)
  }
  const token = store.get(ACT_COOKIE)?.value;
  if (!token) return null;

  try {
    const h = await headers();
    if (!centralActingApplies(effectiveZone(h.get(ZONE_HEADER), h.get("referer")))) return null;
  } catch {
    return null;
  }

  const sessionCookies = store
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => `${c.name}=${c.value}`)
    .sort()
    .join("&");
  const key = crypto.createHash("sha256").update(`${token}|${sessionCookies}`).digest("hex");

  const now = Date.now();
  const cached = verdicts.get(key);
  if (cached && cached.exp > now) return cached.client;

  let client: unknown | null = null;
  try {
    const ctx = await getActingContext();
    if (ctx) {
      const session = await founderSession(ctx.founderId);
      if (session) client = createTokenClient(session.accessToken, session.user);
    }
  } catch {
    client = null;
  }
  verdicts.set(key, { exp: now + VERDICT_TTL_MS, client });
  prune(verdicts, now);
  return client;
}

/**
 * The staff member behind this request when it is running as a founder on their behalf,
 * otherwise null. False outside a request (cron, scheduled sends) and on admin screens.
 */
export async function actingStaffId(): Promise<string | null> {
  if (!isCentralActingEnabled(process.env.ACT_AS_FOUNDER_CENTRAL)) return null;
  try {
    const store = await cookies();
    if (!store.get(ACT_COOKIE)?.value) return null;
    const h = await headers();
    if (!centralActingApplies(effectiveZone(h.get(ZONE_HEADER), h.get("referer")))) return null;
    return (await getActingContext())?.staffId ?? null;
  } catch {
    return null;
  }
}

/** True when this request runs as a founder on behalf of staff. Used to block billing, team changes, account deletion and sending as the founder. */
export async function isActingAsFounder(): Promise<boolean> {
  return (await actingStaffId()) !== null;
}

/**
 * A 403 for actions that stay with the founder while staff act on their behalf: outreach
 * and social campaigns, posting, intro requests and account connections. Null otherwise.
 */
export async function actingBlock(): Promise<NextResponse | null> {
  if (!(await isActingAsFounder())) return null;
  return NextResponse.json(
    { error: "Not available while you act on the founder's behalf. Outreach, social posting and connections stay with the founder." },
    { status: 403 },
  );
}
