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
function toAccount(a: AccountRow): Account {
  // Tokens are sealed at rest (token-cipher); open them just before the adapter uses them.
  return { id: a.id, platform: a.platform, externalMemberId: a.external_member_id, accessToken: openToken(a.access_token), refreshToken: openToken(a.refresh_token), tokenExpiresAt: a.token_expires_at };
}

export type QueueRunResult = { processed: number; published: number; retried: number; failed: number; skipped: number };

export async function runSocialQueue(limit = 20): Promise<QueueRunResult> {
  const supabase = db();
  const now = new Date().toISOString();
  const res: QueueRunResult = { processed: 0, published: 0, retried: 0, failed: 0, skipped: 0 };

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
      supabase.from("social_posts").select("link_url").eq("id", row.post_id).maybeSingle(),
    ]);

    const adapter = account ? ADAPTERS[(account as AccountRow).platform] : undefined;
    if (!account || !adapter) {
      await supabase.from("social_variants").update({ status: "failed", error: "No account or adapter.", updated_at: new Date().toISOString() }).eq("id", row.id);
      res.failed++;
      continue;
    }

    try {
      const variant = toVariant(row, (post as { link_url: string | null } | null)?.link_url ?? null);
      const { externalId, url } = await adapter.publish(variant, toAccount(account as AccountRow));
      // The first comment is best-effort: the post is already live, so a comment
      // failure (e.g. LinkedIn's partner-gated comment API returning 403) must never
      // fail the variant or trigger a re-publish (which would double-post). Record a
      // soft note instead, and still mark the post published.
      let commentNote: string | null = null;
      if (variant.commentText) {
        try {
          await adapter.comment(externalId, variant.commentText, toAccount(account as AccountRow));
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
