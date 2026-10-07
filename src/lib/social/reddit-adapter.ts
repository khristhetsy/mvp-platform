/**
 * Reddit adapter: publishes a text post to one subreddit from the connected account.
 *
 * - Subreddit: REDDIT_SUBREDDIT (default "FounderCapitalRaising", the community iCFO
 *   moderates, where links and promotion are allowed by its own rules).
 * - Title: the first line of the post. Body: the rest, then the first-comment text,
 *   the tracked link, and the iCFO disclaimer. Reddit gets no separate first comment.
 * - Tokens: Reddit access tokens last an hour, so every publish trades the stored
 *   refresh token for a fresh one. No queue change needed.
 *
 * Credential-gated: without REDDIT_CLIENT_ID/SECRET every call throws
 * AdapterNotConfiguredError, which the queue treats as a skip.
 */
import { AdapterNotConfiguredError, type Account, type Metrics, type SocialAdapter, type TokenSet, type Variant } from "@/lib/social/types";
import { REDDIT_TOKEN_URL, REDDIT_USER_AGENT, basicAuth, isRedditConfigured } from "@/lib/social/reddit-oauth";
import { withDisclaimer } from "@/lib/social/reddit";

const SUBMIT_URL = "https://oauth.reddit.com/api/submit";
const TITLE_MAX = 300;

export function redditSubreddit(): string {
  return (process.env.REDDIT_SUBREDDIT?.trim() || "FounderCapitalRaising").replace(/^\/?r\//i, "");
}

/** Split a post into Reddit's title + body (pure; unit-tested). */
export function redditTitleAndText(v: Pick<Variant, "body" | "commentText" | "linkUrl">): { title: string; text: string } {
  const lines = v.body.trim().split("\n");
  const first = (lines.shift() ?? "").trim();
  const title = first.length > TITLE_MAX ? `${first.slice(0, TITLE_MAX - 1).trimEnd()}…` : first || "Founder fundraising";
  const parts = [lines.join("\n").trim()];
  const comment = v.commentText?.trim() || "";
  if (comment) parts.push(comment);
  if (v.linkUrl && !comment.includes(v.linkUrl)) parts.push(v.linkUrl);
  return { title, text: withDisclaimer(parts.filter(Boolean).join("\n\n")) };
}

function requireConfigured(): void {
  if (!isRedditConfigured()) throw new AdapterNotConfiguredError("reddit");
}

async function freshAccessToken(a: Account): Promise<string> {
  if (!a.refreshToken) throw new Error("Reddit account has no refresh token. Reconnect it in Settings.");
  const res = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(process.env.REDDIT_CLIENT_ID as string, process.env.REDDIT_CLIENT_SECRET as string),
      "Content-Type": "application/x-www-form-urlencoded", "User-Agent": REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: a.refreshToken }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Reddit token refresh ${res.status}: ${data.error ?? res.statusText}`);
  return data.access_token;
}

export const redditAdapter: SocialAdapter = {
  supportsComments: () => false,

  async publish(v: Variant, a: Account): Promise<{ externalId: string; url: string }> {
    requireConfigured();
    const token = await freshAccessToken(a);
    const { title, text } = redditTitleAndText(v);
    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": REDDIT_USER_AGENT },
      body: new URLSearchParams({ sr: redditSubreddit(), kind: "self", title, text, api_type: "json", resubmit: "true" }),
    });
    const data = (await res.json().catch(() => ({}))) as { json?: { errors?: unknown[][]; data?: { url?: string; name?: string } } };
    const errors = data.json?.errors ?? [];
    if (!res.ok || errors.length) {
      const why = errors.map((e) => e.slice(1).join(": ")).join("; ") || res.statusText;
      throw new Error(`Reddit submit ${res.status}: ${why}`);
    }
    const externalId = data.json?.data?.name ?? "";
    const url = data.json?.data?.url ?? "";
    if (!externalId) throw new Error("Reddit submit returned no post id.");
    return { externalId, url };
  },

  async comment(): Promise<void> {
    // Not used: supportsComments() is false, the link rides in the body.
  },

  async metrics(_externalId: string, _a: Account): Promise<Metrics> {
    requireConfigured();
    return {};
  },

  async refresh(a: Account): Promise<TokenSet> {
    requireConfigured();
    const accessToken = await freshAccessToken(a);
    return { accessToken, refreshToken: a.refreshToken as string, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() };
  },
};
