/**
 * Social publish queue (build-spec §9). Cron every 5 min → claim due variants →
 * publish + first-comment → mark published; on error, retry with backoff (1m/5m/25m)
 * then fail with the error visible. AdapterNotConfiguredError is a skip, not a retry,
 * so nothing loops while LinkedIn credentials are still absent.
 *
 * Claiming uses an atomic status flip (queued → publishing) as a lightweight
 * SKIP-LOCKED: only the worker that flips the row processes it.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { AdapterNotConfiguredError, type Account, type SocialAdapter, type Variant } from "@/lib/social/types";
import { linkedInAdapter } from "@/lib/social/linkedin-adapter";
import { facebookAdapter } from "@/lib/social/facebook-adapter";
import { backoffMsFor } from "@/lib/social/rules";
import { openToken } from "@/lib/social/token-cipher";

const ADAPTERS: Record<string, SocialAdapter> = { linkedin: linkedInAdapter, facebook: facebookAdapter };

/**
 * Hard ceiling on a single platform call, comfortably inside the function's 60s limit.
 *
 * Without this a hung platform takes the whole function down with it: the variant was
 * already claimed (queued → publishing), so the process dies before any catch block runs
 * and the row is stranded in `publishing` forever — invisible, never retried, because
 * every later pass selects only `queued`. Failing at 20s instead routes the problem into
 * the normal retry path.
 */
const PUBLISH_TIMEOUT_MS = 20_000;
/** A claim older than this can't be a live worker (the function is capped at 60s). */
export const STUCK_CLAIM_MS = 15 * 60 * 1000;

class PublishTimeoutError extends Error {
  constructor(what: string) { super(`${what} timed out after ${PUBLISH_TIMEOUT_MS / 1000}s`); this.name = "PublishTimeoutError"; }
}

/** Reject if the platform call outlives the ceiling. The call itself keeps running — we
 *  can't cancel it — which is exactly why an interrupted variant may still have posted. */
function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new PublishTimeoutError(what)), PUBLISH_TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Mark variants stranded mid-publish so they surface instead of hanging silently.
 *
 * Deliberately does NOT requeue: the claim happens before the API call, so the post may
 * already be live. Auto-retrying would double-post to a real audience, which is worse
 * than a late post. Staff check the platform and choose Requeue or Mark as published.
 */
export async function sweepStuckPublishing(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_CLAIM_MS).toISOString();
  const { data } = await db().from("social_variants")
    .update({
      status: "interrupted",
      error: "Publishing was interrupted — the post may or may not have reached the platform. Check there before retrying.",
      updated_at: now.toISOString(),
    })
    .eq("status", "publishing").lt("updated_at", cutoff).select("id");
  return (data ?? []).length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

type VariantRow = {
  id: string; account_id: string; body: string; comment_text: string | null;
  idempotency_key: string; attempts: number;
};
type AccountRow = {
  id: string; platform: string; external_member_id: string | null;
  access_token: string | null; refresh_token: string | null; token_expires_at: string | null;
};

function toVariant(r: VariantRow, linkUrl: string | null): Variant {
  return { id: r.id, body: r.body, commentText: r.comment_text, linkUrl, idempotencyKey: r.idempotency_key };
}

/** Append the campaign attribution tag (?s=<source_tag>) to a link so clicks →
 *  /fit sessions → signups trace back to the campaign. No-op without both, or if
 *  an `s` param is already present. */
export function taggedLink(url: string | null, sourceTag: string | null): string | null {
  if (!url || !sourceTag) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("s")) u.searchParams.set("s", sourceTag);
    return u.toString();
  } catch {
    return url; // not an absolute URL — leave as-is
  }
}
/** Route a published link through the /r/<post> click tracker (which forwards to the
 *  tagged destination). Falls back to the direct tagged link when there's no post id
 *  or destination. */
export function trackedLink(postId: string | null, linkUrl: string | null, sourceTag: string | null): string | null {
  if (!linkUrl) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!postId || !base) return taggedLink(linkUrl, sourceTag);
  return `${base}/r/${postId}`;
}
function toAccount(a: AccountRow): Account {
  // Tokens are sealed at rest (token-cipher); open them just before the adapter uses them.
  return { id: a.id, platform: a.platform, externalMemberId: a.external_member_id, accessToken: openToken(a.access_token), refreshToken: openToken(a.refresh_token), tokenExpiresAt: a.token_expires_at };
}

export type QueueRunResult = { processed: number; published: number; retried: number; failed: number; skipped: number; interrupted: number };

export async function runSocialQueue(limit = 20): Promise<QueueRunResult> {
  const supabase = db();
  const now = new Date().toISOString();
  // Free anything a previous pass stranded before looking for new work.
  const interrupted = await sweepStuckPublishing().catch(() => 0);
  const res: QueueRunResult = { processed: 0, published: 0, retried: 0, failed: 0, skipped: 0, interrupted };

  const { data: due } = await supabase
    .from("social_variants")
    .select("id, account_id, body, comment_text, idempotency_key, attempts, post_id, next_attempt_at, status")
    .eq("status", "queued")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("next_attempt_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  for (const row of (due ?? []) as (VariantRow & { post_id: string })[]) {
    // Claim atomically: only proceed if we flip queued → publishing.
    const { data: claimed } = await supabase
      .from("social_variants")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // another worker took it

    res.processed++;

    const [{ data: account }, { data: post }] = await Promise.all([
      supabase.from("social_accounts").select("id, platform, external_member_id, access_token, refresh_token, token_expires_at").eq("id", row.account_id).maybeSingle(),
      supabase.from("social_posts").select("link_url, campaign:social_campaigns(source_tag)").eq("id", row.post_id).maybeSingle(),
    ]);

    const adapter = account ? ADAPTERS[(account as AccountRow).platform] : undefined;
    if (!account || !adapter) {
      await supabase.from("social_variants").update({ status: "failed", error: "No account or adapter.", updated_at: new Date().toISOString() }).eq("id", row.id);
      res.failed++;
      continue;
    }

    try {
      const p = post as { link_url: string | null; campaign?: { source_tag: string | null } | null } | null;
      const variant = toVariant(row, trackedLink(row.post_id, p?.link_url ?? null, p?.campaign?.source_tag ?? null));
      const { externalId, url } = await withTimeout(adapter.publish(variant, toAccount(account as AccountRow)), "publish");
      // The first comment is best-effort: the post is already live, so a comment
      // failure (e.g. LinkedIn's partner-gated comment API returning 403) must never
      // fail the variant or trigger a re-publish (which would double-post). Record a
      // soft note instead, and still mark the post published.
      let commentNote: string | null = null;
      if (variant.commentText) {
        try {
          await withTimeout(adapter.comment(externalId, variant.commentText, toAccount(account as AccountRow)), "first comment");
        } catch (ce) {
          commentNote = `Published — first comment skipped: ${ce instanceof Error ? ce.message : "comment failed"}`;
        }
      }
      await supabase.from("social_variants").update({
        status: "published", external_id: externalId, url, published_at: new Date().toISOString(), error: commentNote, updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      res.published++;
    } catch (err) {
      if (err instanceof AdapterNotConfiguredError) {
        await supabase.from("social_variants").update({ status: "skipped", error: err.message, updated_at: new Date().toISOString() }).eq("id", row.id);
        res.skipped++;
        continue;
      }
      const attempts = row.attempts + 1;
      const delay = backoffMsFor(attempts);
      const message = err instanceof Error ? err.message : "Publish failed.";
      if (delay == null) {
        await supabase.from("social_variants").update({ status: "failed", attempts, error: message, updated_at: new Date().toISOString() }).eq("id", row.id);
        res.failed++;
      } else {
        await supabase.from("social_variants").update({
          status: "queued", attempts, next_attempt_at: new Date(Date.now() + delay).toISOString(), error: message, updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        res.retried++;
      }
    }
  }

  return res;
}

/**
 * Put an interrupted variant back in the queue. Staff-initiated only, and only after
 * they've confirmed on the platform that it did NOT go out — see sweepStuckPublishing.
 */
export async function requeueVariant(variantId: string): Promise<boolean> {
  const { error } = await db().from("social_variants")
    .update({ status: "queued", next_attempt_at: null, error: null, updated_at: new Date().toISOString() })
    .eq("id", variantId).in("status", ["interrupted", "failed"]);
  return !error;
}

/** Record that an interrupted variant did reach the platform after all. */
export async function markVariantPublished(variantId: string, externalId?: string | null, url?: string | null): Promise<boolean> {
  const { error } = await db().from("social_variants")
    .update({
      status: "published", published_at: new Date().toISOString(),
      external_id: externalId ?? null, url: url ?? null,
      error: "Marked published manually after an interrupted run.", updated_at: new Date().toISOString(),
    })
    .eq("id", variantId).in("status", ["interrupted", "failed"]);
  return !error;
}
