/**
 * LinkedIn adapter (build-spec §9). Publishes to a personal profile with
 * w_member_social (self-serve, no partner approval). The tagged link goes in the
 * first comment against the post URN, never in the body.
 *
 * Credential-gated: until LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET are set, every
 * method throws AdapterNotConfiguredError, which the queue treats as a skip. Live
 * publishing switches on the moment the OAuth app + tokens exist — no queue change.
 */

import { AdapterNotConfiguredError, type Account, type Metrics, type SocialAdapter, type TokenSet, type Variant } from "@/lib/social/types";

// Monthly versioning; each supported ~a year. Keep here, bump quarterly (§9).
const LINKEDIN_VERSION = "202609";
const REST_BASE = "https://api.linkedin.com/rest";

function configured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID?.trim() && process.env.LINKEDIN_CLIENT_SECRET?.trim());
}

function requireConfigured(): void {
  if (!configured()) throw new AdapterNotConfiguredError("linkedin");
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

export const linkedInAdapter: SocialAdapter = {
  async publish(v: Variant, a: Account): Promise<{ externalId: string; url: string }> {
    requireConfigured();
    if (!a.accessToken || !a.externalMemberId) throw new Error("LinkedIn account is missing a token or member id.");
    const res = await fetch(`${REST_BASE}/posts`, {
      method: "POST",
      headers: headers(a.accessToken),
      body: JSON.stringify({
        author: a.externalMemberId,
        commentary: v.body,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!res.ok) throw new Error(`LinkedIn publish ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    // The post URN comes back in the response header, not the body.
    const externalId = res.headers.get("x-restli-id") ?? "";
    if (!externalId) throw new Error("LinkedIn publish returned no post URN.");
    const url = `https://www.linkedin.com/feed/update/${externalId}`;
    return { externalId, url };
  },

  async comment(externalId: string, text: string, a: Account): Promise<void> {
    requireConfigured();
    if (!a.accessToken || !a.externalMemberId) throw new Error("LinkedIn account is missing a token or member id.");
    const res = await fetch(`${REST_BASE}/socialActions/${encodeURIComponent(externalId)}/comments`, {
      method: "POST",
      headers: headers(a.accessToken),
      body: JSON.stringify({ actor: a.externalMemberId, message: { text } }),
    });
    if (!res.ok) throw new Error(`LinkedIn comment ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  },

  async metrics(_externalId: string, _a: Account): Promise<Metrics> {
    requireConfigured();
    // Impressions/clicks require the analytics endpoints; stubbed until the app is
    // approved for them. Posts rank by in-range founders, not impressions (§9), so
    // this is non-blocking.
    return {};
  },

  async refresh(a: Account): Promise<TokenSet> {
    requireConfigured();
    if (!a.refreshToken) throw new Error("No refresh token on this LinkedIn account.");
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: a.refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID as string,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET as string,
      }),
    });
    if (!res.ok) throw new Error(`LinkedIn token refresh ${res.status}`);
    const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? a.refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  },
};

export function isLinkedInConfigured(): boolean {
  return configured();
}
