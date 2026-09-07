/**
 * Facebook Page adapter (build-spec §9). Publishes to a Page feed via the Graph API;
 * the tagged link posts as a comment on the new post, never in the body — same reach
 * strategy as LinkedIn. One connected account == one Page (external_member_id = page id,
 * access_token = that Page's token).
 *
 * Credential-gated: until META_APP_ID / META_APP_SECRET are set, every method throws
 * AdapterNotConfiguredError, which the queue treats as a skip.
 */

import { AdapterNotConfiguredError, type Account, type Metrics, type SocialAdapter, type TokenSet, type Variant } from "@/lib/social/types";

// Graph API version — bump periodically (Meta supports each ~2 years).
export const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function configured(): boolean {
  return Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
}
function requireConfigured(): void {
  if (!configured()) throw new AdapterNotConfiguredError("facebook");
}

export const facebookAdapter: SocialAdapter = {
  async publish(v: Variant, a: Account): Promise<{ externalId: string; url: string }> {
    requireConfigured();
    if (!a.accessToken || !a.externalMemberId) throw new Error("Facebook account is missing a Page token or Page id.");
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(a.externalMemberId)}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: v.body, access_token: a.accessToken }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok || !data.id) throw new Error(`Facebook publish ${res.status}: ${data.error?.message ?? res.statusText}`);
    // Page feed post id is `{pageId}_{postId}`.
    const url = `https://www.facebook.com/${data.id}`;
    return { externalId: data.id, url };
  },

  async comment(externalId: string, text: string, a: Account): Promise<void> {
    requireConfigured();
    if (!a.accessToken) throw new Error("Facebook account is missing a Page token.");
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(externalId)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, access_token: a.accessToken }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(`Facebook comment ${res.status}: ${data.error?.message ?? res.statusText}`);
    }
  },

  async metrics(_externalId: string, _a: Account): Promise<Metrics> {
    requireConfigured();
    // Post insights require extra permissions/review; stubbed. Posts rank by in-range
    // founders, not impressions (§9), so this is non-blocking.
    return {};
  },

  async refresh(_a: Account): Promise<TokenSet> {
    requireConfigured();
    // Page tokens derived from a long-lived user token don't expire on a fixed schedule
    // and there's no refresh_token grant — re-deriving needs a fresh user token, which
    // means reconnecting. Surface that rather than silently failing.
    throw new Error("Facebook Page tokens can't be refreshed automatically — reconnect the Page.");
  },
};

export function isFacebookConfigured(): boolean {
  return configured();
}
