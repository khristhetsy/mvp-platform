// Act-on-behalf: the single guarded chokepoint that lets a permissioned staff
// member operate a founder's screens as that founder. SECURITY-CRITICAL.
//
// Trust model: the signed cookie is NEVER trusted on its own. Every read
// re-verifies, server-side, that (a) the signature is valid and unexpired, (b)
// the real logged-in user is the same staff member who started the session, and
// (c) that staff member STILL holds the `act_on_behalf` permission. Any failure
// yields null (no impersonation). Without a signing secret the feature is off.
//
// This module only RESOLVES and GUARDS the context. It grants no data access by
// itself — a founder API/page must explicitly opt in by calling getActingContext
// and switching to a founder-scoped service-role client. That keeps the RLS
// bypass surface to code that has deliberately adopted this, not the whole app.

import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { canUser } from "@/lib/rbac/effective-permissions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database, Profile } from "@/lib/supabase/types";

const COOKIE = "icapos_act_as";
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export type ActingContext = { founderId: string; staffId: string };

function signingSecret(): string | null {
  return process.env.TOKEN_ENCRYPTION_SECRET || process.env.CRON_SECRET || null;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function encodeToken(ctx: ActingContext, secret: string): string {
  const body = b64url(JSON.stringify({ f: ctx.founderId, s: ctx.staffId, t: Date.now() }));
  return `${body}.${sign(body, secret)}`;
}

function decodeToken(token: string, secret: string): ActingContext | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(body, secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { f?: string; s?: string; t?: number };
    if (!parsed.f || !parsed.s || !parsed.t) return null;
    if (Date.now() - parsed.t > TTL_MS) return null;
    return { founderId: parsed.f, staffId: parsed.s };
  } catch {
    return null;
  }
}

/** The current logged-in auth user id, or null. */
async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function staffHasPermission(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    return await canUser(supabase, userId, "act_on_behalf");
  } catch {
    return false;
  }
}

/**
 * Returns the active acting context ONLY if the cookie is valid AND the real
 * session user is the same staff member AND they still hold the permission.
 * Otherwise null. Callers must treat null as "no impersonation".
 */
export async function getActingContext(): Promise<ActingContext | null> {
  const secret = signingSecret();
  if (!secret) return null;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const ctx = decodeToken(token, secret);
  if (!ctx) return null;

  const realUser = await currentUserId();
  if (!realUser || realUser !== ctx.staffId) return null;
  if (!(await staffHasPermission(realUser))) return null;

  return ctx;
}

/** The target founder's profile when acting, else null. Loaded via service role. */
export async function getActingFounderProfile(): Promise<Profile | null> {
  const ctx = await getActingContext();
  if (!ctx) return null;
  const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
  const { data } = await admin.from("profiles").select("*").eq("id", ctx.founderId).maybeSingle();
  const profile = data as Profile | null;
  if (!profile || profile.role !== "founder") return null;
  return profile;
}

export type StartResult = { ok: true } | { ok: false; error: string };

/** Begin acting as a founder. Guarded: caller must be staff with the permission
 *  and the target must be a founder. Writes an audit event attributed to staff. */
export async function startActOnBehalf(founderId: string): Promise<StartResult> {
  const secret = signingSecret();
  if (!secret) return { ok: false, error: "Act-on-behalf is not configured." };

  const staffId = await currentUserId();
  if (!staffId) return { ok: false, error: "Not signed in." };
  if (!(await staffHasPermission(staffId))) return { ok: false, error: "You don't have permission to act on behalf." };

  const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
  const { data: target } = await admin.from("profiles").select("id, role").eq("id", founderId).maybeSingle();
  const t = target as { id: string; role: string | null } | null;
  if (!t || t.role !== "founder") return { ok: false, error: "That user is not a founder." };

  const store = await cookies();
  store.set(COOKIE, encodeToken({ founderId, staffId }, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });

  // Best-effort audit — attributed to the acting staff member.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as unknown as SupabaseClient<any>).from("operational_activity_events").insert({
      event_type: "act_on_behalf_started",
      actor_user_id: staffId,
      entity_id: founderId,
      metadata: { founder_id: founderId },
    });
  } catch {
    /* audit is best-effort; never block entering the session */
  }

  return { ok: true };
}

/** End the acting-as session (clears the cookie). */
export async function stopActOnBehalf(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export type ActingFounderScope = {
  profile: Profile;
  /** Service-role client scoped to the founder's data. RLS is bypassed here BY
   *  DESIGN — the guarded context above already proved the actor is permissioned
   *  staff acting as this founder. Callers must attribute writes to the staff id. */
  supabase: SupabaseClient<Database>;
  company: Company;
  actingStaffId: string;
};

/**
 * The single resolver a founder page/API opts into to render as the acting
 * founder. Returns null when there's no valid acting session — callers then fall
 * through to their normal founder-session logic. Resolves the founder's PRIMARY
 * company (act-on-behalf targets the founder's own raise).
 */
export async function resolveActingFounderScope(): Promise<ActingFounderScope | null> {
  const ctx = await getActingContext();
  if (!ctx) return null;
  const founder = await getActingFounderProfile();
  if (!founder) return null;

  const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
  const { data } = await admin
    .from("companies")
    .select("*")
    .eq("founder_id", founder.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const company = data as Company | null;
  if (!company) return null;

  return { profile: founder, supabase: admin, company, actingStaffId: ctx.staffId };
}
