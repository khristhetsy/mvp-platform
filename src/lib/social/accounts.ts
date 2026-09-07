/**
 * social_accounts write + status helpers (build-spec §9). Tokens are sealed on the way
 * in; the queue opens them on the way out (see token-cipher). Upsert keys on
 * (platform, external_member_id) so reconnecting the same LinkedIn profile refreshes
 * its tokens in place rather than creating a duplicate row.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sealToken } from "@/lib/social/token-cipher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type AccountStatus = "connected" | "expiring" | "expired" | "disconnected";

/** connected > 7d out, expiring within 7d, expired past. No expiry ⇒ connected. */
export function deriveStatus(tokenExpiresAt: string | null): AccountStatus {
  if (!tokenExpiresAt) return "connected";
  const ms = new Date(tokenExpiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  if (ms <= 7 * 24 * 60 * 60 * 1000) return "expiring";
  return "connected";
}

export type UpsertLinkedInAccountInput = {
  memberUrn: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
};

export async function upsertLinkedInAccount(input: UpsertLinkedInAccountInput): Promise<{ id: string }> {
  const row = {
    platform: "linkedin",
    external_member_id: input.memberUrn,
    display_name: input.displayName,
    access_token: sealToken(input.accessToken),
    refresh_token: sealToken(input.refreshToken),
    token_expires_at: input.tokenExpiresAt,
    status: deriveStatus(input.tokenExpiresAt),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db()
    .from("social_accounts")
    .upsert(row, { onConflict: "platform,external_member_id" })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to save LinkedIn account: ${error.message}`);
  return { id: (data as { id: string }).id };
}
