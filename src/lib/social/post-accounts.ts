/**
 * Which connected accounts a post (or a whole series) goes to. Service-role only.
 *
 *   addAccountToPost   — "Post here too": queue the post for one more account.
 *   setSeriesAccounts  — the series "Posts to" picker: the template goes to every
 *                        ticked account, and every not-yet-published post in the
 *                        series gains or loses that account's copy. Published and
 *                        in-flight copies are never touched.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** Variant states that are live or in flight; a series account change leaves them alone. */
const LOCKED = ["published", "publishing", "interrupted", "archived"];

type Template = { accountId: string; body: string };

/** Pure: the series template after the account picker changes. New accounts start from the first account's copy. */
export function nextSeriesVariants(current: readonly Template[], accountIds: readonly string[], fallbackBody: string): Template[] {
  const byId = new Map(current.map((v) => [v.accountId, v]));
  const base = current[0]?.body ?? fallbackBody;
  return [...new Set(accountIds)].map((id) => byId.get(id) ?? { accountId: id, body: base });
}

/** Pure: per post, which accounts to add a queued copy for and which unpublished copies to remove. */
export function seriesPostChanges(
  variants: ReadonlyArray<{ id: string; account_id: string; status: string }>,
  accountIds: readonly string[],
): { add: string[]; remove: string[] } {
  const want = new Set(accountIds);
  const have = new Set(variants.map((v) => v.account_id));
  return {
    add: [...want].filter((a) => !have.has(a)),
    remove: variants.filter((v) => !want.has(v.account_id) && !LOCKED.includes(v.status)).map((v) => v.id),
  };
}

async function connectedAccountIds(ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await db().from("social_accounts").select("id").in("id", [...ids]).neq("status", "disconnected").is("disconnected_at", null);
  return new Set(((data ?? []) as Array<{ id: string }>).map((r) => r.id));
}

export async function addAccountToPost(postId: string, accountId: string, now = new Date()): Promise<{ ok: true; variantId: string } | { ok: false; error: string }> {
  if (!(await connectedAccountIds([accountId])).has(accountId)) return { ok: false, error: "That account isn't connected." };
  const [{ data: post }, { data: variants }] = await Promise.all([
    db().from("social_posts").select("id, body, comment_text, scheduled_at, deleted_at").eq("id", postId).maybeSingle(),
    db().from("social_variants").select("id, account_id, body, comment_text").eq("post_id", postId).order("created_at", { ascending: true }),
  ]);
  if (!post || post.deleted_at) return { ok: false, error: "Post not found." };
  const rows = (variants ?? []) as Array<{ id: string; account_id: string; body: string | null; comment_text: string | null }>;
  if (rows.some((v) => v.account_id === accountId)) return { ok: false, error: "This post already goes to that account." };
  const source = rows[0];
  // Goes out at the post's time if that's still ahead, otherwise on the next queue run.
  const when = post.scheduled_at && new Date(post.scheduled_at).getTime() > now.getTime() ? post.scheduled_at : now.toISOString();
  const { data, error } = await db().from("social_variants").insert({
    post_id: postId, account_id: accountId, body: source?.body ?? post.body ?? "", comment_text: source?.comment_text ?? post.comment_text ?? null,
    status: "queued", scheduled_at: when, next_attempt_at: when, idempotency_key: `${postId}:${accountId}`,
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't add the account." };
  return { ok: true, variantId: data.id as string };
}

export async function setSeriesAccounts(recurrenceId: string, accountIds: readonly string[], now = new Date()): Promise<{ ok: true; added: number; removed: number } | { ok: false; error: string }> {
  const unique = [...new Set(accountIds)];
  if (unique.length === 0) return { ok: false, error: "Pick at least one account." };
  const connected = await connectedAccountIds(unique);
  if (unique.some((id) => !connected.has(id))) return { ok: false, error: "One of those accounts isn't connected." };

  const { data: row } = await db().from("social_recurrences").select("id, body, comment_text, variants").eq("id", recurrenceId).maybeSingle();
  if (!row) return { ok: false, error: "Series not found." };
  const template = nextSeriesVariants(((row.variants as Template[]) ?? []), unique, (row.body as string) ?? "");
  const { error: upErr } = await db().from("social_recurrences")
    .update({ variants: template, account_ids: template.map((v) => v.accountId), updated_at: now.toISOString() }).eq("id", recurrenceId);
  if (upErr) return { ok: false, error: upErr.message };

  // Posts already made for the series that haven't gone out yet.
  const { data: posts } = await db().from("social_posts").select("id, scheduled_at")
    .eq("recurrence_id", recurrenceId).is("deleted_at", null).gt("scheduled_at", now.toISOString());
  const postRows = (posts ?? []) as Array<{ id: string; scheduled_at: string }>;
  const bodyOf = new Map(template.map((v) => [v.accountId, v.body]));
  let added = 0, removed = 0;
  for (const p of postRows) {
    const { data: vs } = await db().from("social_variants").select("id, account_id, status").eq("post_id", p.id);
    const change = seriesPostChanges((vs ?? []) as Array<{ id: string; account_id: string; status: string }>, unique);
    if (change.add.length) {
      const { error } = await db().from("social_variants").insert(change.add.map((a) => ({
        post_id: p.id, account_id: a, body: bodyOf.get(a) ?? "", comment_text: (row.comment_text as string) ?? null,
        status: "queued", scheduled_at: p.scheduled_at, next_attempt_at: p.scheduled_at, idempotency_key: `${p.id}:${a}`,
      })));
      if (!error) added += change.add.length;
    }
    if (change.remove.length) {
      const { error } = await db().from("social_variants").delete().in("id", change.remove);
      if (!error) removed += change.remove.length;
    }
  }
  return { ok: true, added, removed };
}
