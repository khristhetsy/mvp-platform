/**
 * Social Media Hub adapter contract (build-spec §9). Every platform lives behind
 * this interface so the queue never touches platform specifics — LinkedIn today,
 * Facebook or a unified API later, without changing the queue.
 */

export type Variant = {
  id: string;
  /** Rewritten body for this account. */
  body: string;
  /** First-comment text carrying the tagged link (never in the body). */
  commentText: string | null;
  linkUrl: string | null;
  /** Unique per variant — one publish, ever. */
  idempotencyKey: string;
};

export type Account = {
  id: string;
  platform: string;
  externalMemberId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
};

export type Metrics = { impressions?: number; clicks?: number };
export type TokenSet = { accessToken: string; refreshToken: string; expiresAt: string };

export interface SocialAdapter {
  /** Publish the variant; returns the external post id (URN) + permalink. */
  publish(v: Variant, a: Account): Promise<{ externalId: string; url: string }>;
  /** Post the tagged-link comment against a published post. */
  comment(externalId: string, text: string, a: Account): Promise<void>;
  /** Read engagement metrics for a published post. */
  metrics(externalId: string, a: Account): Promise<Metrics>;
  /** Refresh an expiring token set. */
  refresh(a: Account): Promise<TokenSet>;
}

/** Thrown when an adapter's platform credentials aren't configured yet. The queue
 *  treats this as a non-retryable skip, not a failure to retry. */
export class AdapterNotConfiguredError extends Error {
  constructor(platform: string) {
    super(`${platform} adapter is not configured`);
    this.name = "AdapterNotConfiguredError";
  }
}
