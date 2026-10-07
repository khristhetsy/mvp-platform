/**
 * Reddit OAuth 2.0 connect flow for the Social Media Hub.
 *
 *   authorize → Reddit consent (identity submit), duration=permanent for a refresh token
 *   callback  → exchange code for tokens, read the username via /api/v1/me, store
 *
 * Reddit access tokens last one hour, so the adapter trades the stored refresh token
 * for a fresh access token on every publish (see reddit-adapter).
 *
 * Env: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET (a "web app" at reddit.com/prefs/apps),
 * optional REDDIT_REDIRECT_URI. The redirect registered on Reddit must be exactly
 * https://icapos.com/api/social/reddit/callback.
 */
import { getAppUrl } from "@/lib/env";
import type { LinkedInOAuthEnv } from "@/lib/social/linkedin-oauth";

const AUTHORIZE_URL = "https://www.reddit.com/api/v1/authorize";
export const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const ME_URL = "https://oauth.reddit.com/api/v1/me";

export const REDDIT_SCOPES = "identity submit";
export const REDDIT_STATE_COOKIE = "rd_oauth_state";

/** Reddit asks every API client for a descriptive User-Agent. */
export const REDDIT_USER_AGENT = "web:com.icapos.social:v1.0 (by iCFO Capital)";

/** Same shape as the LinkedIn env so the signed-state helpers are shared. */
export type RedditOAuthEnv = LinkedInOAuthEnv;

export function getRedditOAuthEnv(preferredOrigin?: string): RedditOAuthEnv | null {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const explicit = process.env.REDDIT_REDIRECT_URI?.trim();
  const base = explicit ? null : (preferredOrigin || getAppUrl());
  const redirectUri = explicit || (base ? `${base.replace(/\/$/, "")}/api/social/reddit/callback` : null);
  if (!redirectUri) return null;
  const stateSecret = process.env.TOKEN_ENCRYPTION_SECRET?.trim() || clientSecret;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export function isRedditConfigured(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID?.trim() && process.env.REDDIT_CLIENT_SECRET?.trim());
}

export function buildRedditAuthorizeUrl(env: RedditOAuthEnv, state: string): string {
  const params = new URLSearchParams({
    client_id: env.clientId,
    response_type: "code",
    state,
    redirect_uri: env.redirectUri,
    duration: "permanent",
    scope: REDDIT_SCOPES,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export type RedditTokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; error?: string };

export async function exchangeRedditCode(env: RedditOAuthEnv, code: string): Promise<RedditTokenResponse> {
  const res = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(env.clientId, env.clientSecret), "Content-Type": "application/x-www-form-urlencoded", "User-Agent": REDDIT_USER_AGENT },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: env.redirectUri }),
  });
  const data = (await res.json().catch(() => ({}))) as RedditTokenResponse;
  if (!res.ok || data.error || !data.access_token) throw new Error(`Reddit token exchange ${res.status}: ${data.error ?? res.statusText}`);
  return data;
}

export async function fetchRedditUsername(accessToken: string): Promise<string> {
  const res = await fetch(ME_URL, { headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": REDDIT_USER_AGENT } });
  if (!res.ok) throw new Error(`Reddit identity ${res.status}`);
  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("Reddit returned no username.");
  return data.name;
}
