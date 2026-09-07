/**
 * LinkedIn OAuth 2.0 connect flow (build-spec §9) — the piece that turns the app's
 * LINKEDIN_CLIENT_ID/SECRET into a connected account with a posting token.
 *
 *   authorize  → LinkedIn consent (openid profile w_member_social)
 *   callback   → exchange code for tokens, read the member URN via /userinfo, store
 *
 * The author URN (urn:li:person:{sub}) is what linkedin-adapter.publish() posts as.
 * Distinct from the Supabase Auth LinkedIn provider (login only, no w_member_social).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/env";

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

/** openid+profile identify the member (sub → author URN); w_member_social is the posting grant. */
export const LINKEDIN_SCOPES = "openid profile w_member_social";

export const LINKEDIN_STATE_COOKIE = "li_oauth_state";
export const LINKEDIN_STATE_MAX_AGE = 600; // 10 minutes

export type LinkedInOAuthEnv = { clientId: string; clientSecret: string; redirectUri: string; stateSecret: string };

/**
 * Resolves OAuth config. redirectUri is LINKEDIN_REDIRECT_URI if set, else
 * `${appUrl}/api/social/linkedin/callback`. Returns null (flow unavailable) unless
 * client id/secret AND a resolvable redirect URI are present.
 */
export function getLinkedInOAuthEnv(): LinkedInOAuthEnv | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const explicit = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const appUrl = getAppUrl();
  const redirectUri = explicit || (appUrl ? `${appUrl.replace(/\/$/, "")}/api/social/linkedin/callback` : null);
  if (!redirectUri) return null;

  // Prefer the shared token secret; fall back to the client secret so state signing
  // still works with only the LinkedIn credentials set.
  const stateSecret = process.env.TOKEN_ENCRYPTION_SECRET?.trim() || clientSecret;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export function isLinkedInOAuthConfigured(): boolean {
  return getLinkedInOAuthEnv() !== null;
}

export function buildAuthorizeUrl(env: LinkedInOAuthEnv, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    state,
    scope: LINKEDIN_SCOPES,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// --- CSRF state: HMAC-signed {userId}.{nonce}.{ts}, mirrored in an httpOnly cookie ---

export function createLinkedInState(env: LinkedInOAuthEnv, userId: string): string {
  const payload = `${userId}:${randomBytes(16).toString("hex")}:${Date.now()}`;
  const sig = createHmac("sha256", env.stateSecret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyLinkedInState(env: LinkedInOAuthEnv, state: string, expectedUserId: string): boolean {
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
  return Number.isFinite(ts) && Date.now() - ts <= LINKEDIN_STATE_MAX_AGE * 1000;
}

export function linkedInStateCookieOptions(maxAge = LINKEDIN_STATE_MAX_AGE) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

// --- token exchange + member identity ---

export type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

export async function exchangeLinkedInCode(env: LinkedInOAuthEnv, code: string): Promise<LinkedInTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.redirectUri,
      client_id: env.clientId,
      client_secret: env.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return (await res.json()) as LinkedInTokenResponse;
}

export type LinkedInMember = { sub: string; name: string | null; memberUrn: string };

export async function fetchLinkedInMember(accessToken: string): Promise<LinkedInMember> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`LinkedIn userinfo ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = (await res.json()) as { sub?: string; name?: string };
  if (!data.sub) throw new Error("LinkedIn userinfo returned no member id.");
  return { sub: data.sub, name: data.name ?? null, memberUrn: `urn:li:person:${data.sub}` };
}

export function tokenExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
