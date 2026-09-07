/**
 * Meta (Facebook) OAuth 2.0 connect flow (build-spec §9) — turns the app's
 * META_APP_ID/SECRET into connected Page accounts with long-lived Page tokens.
 *
 *   authorize → Facebook Login consent (Page scopes, or a config_id for
 *               Facebook Login for Business)
 *   callback  → code → short-lived user token → long-lived user token →
 *               GET /me/accounts → one Page token per managed Page
 *
 * Each Page becomes a social_accounts row. Page tokens minted from a long-lived user
 * token are themselves long-lived, so publishing keeps working without a refresh grant.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/env";
import { GRAPH_VERSION } from "@/lib/social/facebook-adapter";

const DIALOG_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Page management + posting. Ignored when META_LOGIN_CONFIG_ID is set (the config carries them). */
export const META_SCOPES = "pages_show_list,pages_manage_posts,pages_read_engagement";

/**
 * Facebook Login for Business requires a config_id — a plain scope request returns
 * missing_code. This is the "iCapOS Page publishing" configuration (public, non-secret
 * id) used as the default so the flow works without a Vercel env var; override with
 * META_LOGIN_CONFIG_ID if the config ever changes.
 */
const DEFAULT_META_LOGIN_CONFIG_ID = "1381571883957072";

export const META_STATE_COOKIE = "fb_oauth_state";
export const META_STATE_MAX_AGE = 600; // 10 minutes

export type MetaOAuthEnv = { appId: string; appSecret: string; redirectUri: string; stateSecret: string; configId: string | null };

/**
 * Resolves OAuth config. redirectUri is META_REDIRECT_URI if set, else
 * `${preferredOrigin ?? appUrl}/api/social/facebook/callback`. Pass the request origin
 * (originFromRequest) so the redirect matches the domain the user is on rather than
 * NEXT_PUBLIC_APP_URL / the internal Vercel host. configId supports Facebook Login for
 * Business. Returns null unless app id/secret AND a resolvable redirect URI exist.
 */
export function getMetaOAuthEnv(preferredOrigin?: string): MetaOAuthEnv | null {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;

  const explicit = process.env.META_REDIRECT_URI?.trim();
  const base = explicit ? null : (preferredOrigin || getAppUrl());
  const redirectUri = explicit || (base ? `${base.replace(/\/$/, "")}/api/social/facebook/callback` : null);
  if (!redirectUri) return null;

  const stateSecret = process.env.TOKEN_ENCRYPTION_SECRET?.trim() || appSecret;
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim() || DEFAULT_META_LOGIN_CONFIG_ID;
  return { appId, appSecret, redirectUri, stateSecret, configId };
}

export function isMetaConfigured(): boolean {
  return getMetaOAuthEnv() !== null;
}

export function buildMetaAuthorizeUrl(env: MetaOAuthEnv, state: string): string {
  const params = new URLSearchParams({
    client_id: env.appId,
    redirect_uri: env.redirectUri,
    state,
    response_type: "code",
  });
  // Facebook Login for Business uses a saved configuration; classic login uses scope.
  if (env.configId) params.set("config_id", env.configId);
  else params.set("scope", META_SCOPES);
  return `${DIALOG_URL}?${params.toString()}`;
}

// --- CSRF state (mirrors LinkedIn): HMAC-signed {userId}.{nonce}.{ts} + httpOnly cookie ---

export function createMetaState(env: MetaOAuthEnv, userId: string): string {
  const payload = `${userId}:${randomBytes(16).toString("hex")}:${Date.now()}`;
  const sig = createHmac("sha256", env.stateSecret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyMetaState(env: MetaOAuthEnv, state: string, expectedUserId: string): boolean {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return false;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", env.stateSecret).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const [userId, , tsRaw] = payload.split(":");
  if (userId !== expectedUserId) return false;
  const ts = Number(tsRaw);
  return Number.isFinite(ts) && Date.now() - ts <= META_STATE_MAX_AGE * 1000;
}

export function metaStateCookieOptions(maxAge = META_STATE_MAX_AGE) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

// --- token exchange + Page fetch ---

/** code → short-lived user access token. */
export async function exchangeMetaCode(env: MetaOAuthEnv, code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: env.appId,
    client_secret: env.appSecret,
    redirect_uri: env.redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
  if (!res.ok || !data.access_token) throw new Error(`Meta token exchange ${res.status}: ${data.error?.message ?? res.statusText}`);
  return data.access_token;
}

/** short-lived → long-lived (~60 day) user token. */
export async function exchangeLongLivedUserToken(env: MetaOAuthEnv, shortLivedToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: env.appId,
    client_secret: env.appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
  if (!res.ok || !data.access_token) throw new Error(`Meta long-lived exchange ${res.status}: ${data.error?.message ?? res.statusText}`);
  return data.access_token;
}

export type MetaPage = { id: string; name: string; accessToken: string };

/** GET /me/accounts → Pages the user manages, each with its own (long-lived) Page token. */
export async function fetchManagedPages(userAccessToken: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({ fields: "id,name,access_token", limit: "100", access_token: userAccessToken });
  const res = await fetch(`${GRAPH_BASE}/me/accounts?${params.toString()}`);
  const data = (await res.json().catch(() => ({}))) as { data?: { id: string; name: string; access_token: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Meta /me/accounts ${res.status}: ${data.error?.message ?? res.statusText}`);
  return (data.data ?? []).map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
}
