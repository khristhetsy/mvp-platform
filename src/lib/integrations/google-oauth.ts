import { encryptSecret } from "@/lib/integrations/token-encryption";
import { assertGoogleOAuthEnv, getGoogleOAuthEnv, isGoogleOAuthConfigured } from "@/lib/integrations/google-env";

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export type GoogleUserInfo = {
  id: string;
  email: string;
};

export function buildGoogleAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = assertGoogleOAuthEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const { clientId, clientSecret, redirectUri } = assertGoogleOAuthEnv();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const payload = (await response.json().catch(() => null)) as GoogleTokenResponse & { error?: string };

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error ?? "Unable to exchange Google authorization code.");
  }

  return payload;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = assertGoogleOAuthEnv();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const payload = (await response.json().catch(() => null)) as GoogleTokenResponse & { error?: string };

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error ?? "Unable to refresh Google access token.");
  }

  return payload;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = (await response.json().catch(() => null)) as GoogleUserInfo & { error?: { message?: string } };

  if (!response.ok || !payload?.id || !payload?.email) {
    throw new Error(payload?.error?.message ?? "Unable to load Google account profile.");
  }

  return payload;
}

export async function revokeGoogleToken(token: string) {
  const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) {
    throw new Error("Unable to revoke Google token.");
  }
}

export function encryptGoogleTokens(input: { accessToken: string; refreshToken?: string | null }) {
  return {
    access_token_encrypted: encryptSecret(input.accessToken),
    refresh_token_encrypted: input.refreshToken ? encryptSecret(input.refreshToken) : null,
  };
}

export function tokenExpiresAt(expiresInSeconds: number) {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function parseGoogleScopes(scope: string) {
  return scope.split(/\s+/).filter(Boolean);
}

export { isGoogleOAuthConfigured, getGoogleOAuthEnv };
