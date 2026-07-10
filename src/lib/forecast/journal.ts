// Sales journal — append-only entries (human notes/wins/losses/deals + system events).
// DB triggers enforce no-delete and only-pinned-mutable; we never expose update/delete.
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type JournalType = "note" | "win" | "loss" | "deal" | "system";
export interface JournalEntry {
  id: string; entry_type: JournalType; body: string; tags: string[]; pinned: boolean;
  author_id: string | null; author_name: string | null; deal_ref: string | null;
  snapshot_ref: string | null; created_at: string;
}

export async function listJournal(filter?: JournalType | "all"): Promise<JournalEntry[]> {
  let q = db().from("sales_journal_entries")
    .select("id, entry_type, body, tags, pinned, author_id, deal_ref, snapshot_ref, created_at")
    .order("created_at", { ascending: false }).limit(500);
  if (filter && filter !== "all") q = q.eq("entry_type", filter);
  const { data } = await q;
  const rows = (data ?? []) as Array<Omit<JournalEntry, "author_name">>;
  const ids = [...new Set(rows.map((r) => r.author_id).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await db().from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      names.set(p.id, p.full_name ?? p.email ?? "Staff");
    }
  }
  return rows.map((r) => ({ ...r, author_name: r.author_id ? names.get(r.author_id) ?? "Staff" : null }));
}

/** Parse #hashtags out of the body into the tags column. */
function extractTags(body: string): string[] {
  return [...new Set((body.match(/#[\w-]+/g) ?? []).map((t) => t.slice(1)))];
}

export async function addJournalEntry(input: {
  entry_type: Exclude<JournalType, "system">; body: string; authorId: string; dealRef?: string | null;
}): Promise<JournalEntry> {
  const { data, error } = await db().from("sales_journal_entries")
    .insert({ entry_type: input.entry_type, body: input.body, tags: extractTags(input.body), author_id: input.authorId, deal_ref: input.dealRef ?? null })
    .select("id, entry_type, body, tags, pinned, author_id, deal_ref, snapshot_ref, created_at").single();
  if (error) throw new Error(error.message);
  return { ...(data as Omit<JournalEntry, "author_name">), author_name: null };
}

/** System entries — insertable only by service paths (compute route, rollup cron). */
export async function addSystemJournalEntry(body: string, snapshotRef?: string | null): Promise<void> {
  await db().from("sales_journal_entries").insert({ entry_type: "system", body, tags: [], author_id: null, snapshot_ref: snapshotRef ?? null });
}

export async function setJournalPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await db().from("sales_journal_entries").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
}
