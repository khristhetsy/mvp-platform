/** Read helpers for the Social Media Hub admin screen. Service-role only. */

import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type SocialAccount = { id: string; platform: string; display_name: string | null; status: string; token_expires_at: string | null };
export type QueueItem = { id: string; status: string; body: string; url: string | null; error: string | null; attempts: number; next_attempt_at: string | null; published_at: string | null };

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const { data } = await db().from("social_accounts").select("id, platform, display_name, status, token_expires_at").order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as SocialAccount[];
}

export async function listQueue(limit = 50): Promise<QueueItem[]> {
  const { data } = await db()
    .from("social_variants")
    .select("id, status, body, url, error, attempts, next_attempt_at, published_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as QueueItem[];
}
