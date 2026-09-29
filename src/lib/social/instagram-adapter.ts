/**
 * Instagram adapter — publishes to an Instagram Business / Creator account through the
 * Graph API's content-publishing flow (two steps: create a media container from a public
 * image URL, then publish it). One connected account == one Instagram user
 * (external_member_id = IG user id, access_token = the token of the Facebook Page it's
 * linked to). Instagram has no text-only posts, so a variant without an image is a hard
 * failure (no retry). The tagged link goes in the first comment, like every platform here.
 *
 * Credential-gated like Facebook: without META_APP_ID / META_APP_SECRET every method
 * throws AdapterNotConfiguredError, which the queue treats as a skip.
 */

import { AdapterNotConfiguredError, type Account, type Metrics, type SocialAdapter, type TokenSet, type Variant } from "@/lib/social/types";
import { GRAPH_VERSION } from "@/lib/social/facebook-adapter";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
/** Image containers are usually ready within a second or two; video takes longer. */
const CONTAINER_POLL_MS = 1500;
const CONTAINER_POLL_MAX = 8;

function configured(): boolean {
  return Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
}
function requireConfigured(): void {
  if (!configured()) throw new AdapterNotConfiguredError("instagram");
}

type GraphError = { error?: { message?: string; code?: number } };
async function graph<T>(path: string, body: Record<string, string>, method: "POST" | "GET" = "POST"): Promise<T> {
  const params = new URLSearchParams(body);
  const res = method === "GET"
    ? await fetch(`${GRAPH_BASE}/${path}?${params.toString()}`)
    : await fetch(`${GRAPH_BASE}/${path}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const data = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok) throw new Error(`Instagram ${path.split("/").pop()} ${res.status}: ${data.error?.message ?? res.statusText}`);
  return data;
}

/** Instagram captions cap at 2,200 chars; keep the body intact and trim only if needed. */
export function instagramCaption(body: string): string {
  return body.length <= 2200 ? body : `${body.slice(0, 2197)}…`;
}

export const instagramAdapter: SocialAdapter = {
  async publish(v: Variant, a: Account): Promise<{ externalId: string; url: string }> {
    requireConfigured();
    if (!a.accessToken || !a.externalMemberId) throw new Error("Instagram account is missing a token or user id.");
    if (!v.imageUrl) throw new Error("Instagram needs an image — add an image URL to the post.");
    const ig = encodeURIComponent(a.externalMemberId);

    // 1. Media container from the public image URL.
    const created = await graph<{ id?: string }>(`${ig}/media`, { image_url: v.imageUrl, caption: instagramCaption(v.body), access_token: a.accessToken });
    if (!created.id) throw new Error("Instagram did not return a media container id.");

    // 2. Wait for the container to be ready (FINISHED); ERROR/EXPIRED are terminal.
    for (let i = 0; i < CONTAINER_POLL_MAX; i++) {
      const st = await graph<{ status_code?: string; status?: string }>(encodeURIComponent(created.id), { fields: "status_code,status", access_token: a.accessToken }, "GET");
      if (st.status_code === "FINISHED") break;
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error(`Instagram could not process the image (${st.status ?? st.status_code}). Check the image URL is public JPEG/PNG under 8 MB.`);
      if (i === CONTAINER_POLL_MAX - 1) throw new Error("Instagram is still processing the image — will retry.");
      await new Promise((r) => setTimeout(r, CONTAINER_POLL_MS));
    }

    // 3. Publish.
    const published = await graph<{ id?: string }>(`${ig}/media_publish`, { creation_id: created.id, access_token: a.accessToken });
    if (!published.id) throw new Error("Instagram did not return a media id after publish.");
    const link = await graph<{ permalink?: string }>(encodeURIComponent(published.id), { fields: "permalink", access_token: a.accessToken }, "GET").catch(() => ({ permalink: undefined }));
    return { externalId: published.id, url: link.permalink ?? `https://www.instagram.com/` };
  },

  async comment(externalId: string, text: string, a: Account): Promise<void> {
    requireConfigured();
    if (!a.accessToken) throw new Error("Instagram account is missing a token.");
    await graph(`${encodeURIComponent(externalId)}/comments`, { message: text, access_token: a.accessToken });
  },

  async metrics(_externalId: string, _a: Account): Promise<Metrics> {
    requireConfigured();
    // Media insights need instagram_manage_insights; posts rank by in-range founders, not
    // impressions, so this stays a stub like Facebook's.
    return {};
  },

  async refresh(_a: Account): Promise<TokenSet> {
    requireConfigured();
    throw new Error("Instagram uses its Facebook Page's token, which can't be refreshed automatically — reconnect the Page.");
  },
};

export function isInstagramConfigured(): boolean {
  return configured();
}
