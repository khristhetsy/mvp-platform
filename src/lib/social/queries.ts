/** Read helpers for the Social Media Hub admin screen. Service-role only. */

import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type SocialAccount = { id: string; platform: string; display_name: string | null; status: string; token_expires_at: string | null };
export type QueueItem = {
  id: string; status: string; body: string; comment_text: string | null; url: string | null; error: string | null;
  attempts: number; next_attempt_at: string | null; published_at: string | null; scheduled_at: string | null; gcal_event_id: string | null;
  department: string | null; platform: string | null; account_name: string | null; link_url: string | null;
};

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const { data } = await db().from("social_accounts").select("id, platform, display_name, status, token_expires_at").order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as SocialAccount[];
}

export async function listQueue(limit = 200): Promise<QueueItem[]> {
  const { data } = await db()
    .from("social_variants")
    .select("id, status, body, comment_text, url, error, attempts, next_attempt_at, published_at, scheduled_at, gcal_event_id, account:social_accounts(platform, display_name), post:social_posts(department, link_url)")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const acc = r.account as { platform?: string; display_name?: string } | null;
    const post = r.post as { department?: string | null; link_url?: string | null } | null;
    return {
      id: String(r.id), status: String(r.status), body: String(r.body ?? ""), comment_text: (r.comment_text as string) ?? null,
      url: (r.url as string) ?? null, error: (r.error as string) ?? null, attempts: (r.attempts as number) ?? 0,
      next_attempt_at: (r.next_attempt_at as string) ?? null, published_at: (r.published_at as string) ?? null,
      scheduled_at: (r.scheduled_at as string) ?? null, gcal_event_id: (r.gcal_event_id as string) ?? null,
      department: post?.department ?? null, platform: acc?.platform ?? null, account_name: acc?.display_name ?? null, link_url: post?.link_url ?? null,
    };
  });
}

export type SocialSettings = { approve_before_publish: boolean; rewrite_per_account: boolean; skip_empty_slot: boolean; auto_publish: boolean; rotation: string[] };
export type SocialSlot = { id: string; weekday: number; time_local: string };

export async function getSocialSettings(): Promise<SocialSettings> {
  const { data } = await db().from("social_settings").select("approve_before_publish, rewrite_per_account, skip_empty_slot, auto_publish, rotation").eq("id", 1).maybeSingle();
  return (data as SocialSettings | null) ?? { approve_before_publish: true, rewrite_per_account: true, skip_empty_slot: true, auto_publish: false, rotation: ["proof_case", "teardown", "named_ask"] };
}

export async function getSlots(): Promise<SocialSlot[]> {
  const { data } = await db().from("social_slots").select("id, weekday, time_local").order("weekday").order("time_local");
  return (data ?? []) as SocialSlot[];
}
