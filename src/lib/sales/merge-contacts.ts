/**
 * Merge duplicate Sales Hub contacts (server side).
 *
 * The merge itself is one Postgres function (merge_crm_contacts, migration 20260930160000), so moving
 * every reference and deleting the duplicates happens in a single transaction. This module loads what
 * the Merge dialog shows and calls it. Every merge is logged in contact_merges and can be undone with
 * undo_contact_merge.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { reindexContacts } from "@/lib/fit/match-index";
import { logActivity } from "@/lib/sales/activity";
import type { DuplicateGroup, MergeCandidate, MergeField } from "@/lib/sales/merge-contacts-shared";

const PROFILE_KEYS = ["investorTypes", "industries", "fundingStages", "operatingStages", "capital", "businessEntity"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export async function listDuplicateGroups(q: string, offset: number, limit = 25): Promise<{ groups: DuplicateGroup[]; totalGroups: number; totalExtra: number }> {
  const { data, error } = await db().rpc("contact_duplicate_groups", { p_q: q.trim() || null, p_offset: offset, p_limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ email: string; n: number; total_groups: number; total_extra: number; members: DuplicateGroup["members"] }>;
  return {
    groups: rows.map((r) => ({ email: r.email, count: r.n, members: r.members ?? [] })),
    totalGroups: Number(rows[0]?.total_groups ?? 0),
    totalExtra: Number(rows[0]?.total_extra ?? 0),
  };
}

export async function loadMergeCandidates(ids: string[]): Promise<MergeCandidate[]> {
  const client = db();
  const [{ data, error }, m, l, p] = await Promise.all([
    client.from("crm_contacts").select("id, name, company, email, phone, website, contact_type, source, created_on, tags, profile").in("id", ids),
    client.from("ir_matches").select("investor_contact_id").in("investor_contact_id", ids),
    client.from("marketing_contacts").select("crm_contact_id").in("crm_contact_id", ids),
    client.from("ir_projects").select("founder_contact_id").in("founder_contact_id", ids),
  ]);
  if (error) throw new Error(error.message);
  const count = (rows: unknown, col: string, id: string) => ((rows ?? []) as Array<Record<string, string>>).filter((r) => r[col] === id).length;
  const byId = new Map(((data ?? []) as Array<Record<string, unknown>>).map((r) => [r.id as string, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id); if (!r) return [];
    const profile = (r.profile ?? {}) as Record<string, unknown>;
    const filled = PROFILE_KEYS.filter((k) => Array.isArray(profile[k]) && (profile[k] as unknown[]).length > 0);
    return [{
      id, name: (r.name as string) ?? null, company: (r.company as string) ?? null, email: (r.email as string) ?? null,
      phone: (r.phone as string) ?? null, website: (r.website as string) ?? null, type: (r.contact_type as string) ?? "other",
      source: (r.source as string) ?? null, createdOn: (r.created_on as string) ?? null, tags: (r.tags as string[]) ?? [],
      profileFields: filled.length,
      profileSummary: filled.flatMap((k) => (profile[k] as unknown[]).map(String)).slice(0, 6),
      refs: { irMatches: count(m.data, "investor_contact_id", id), lists: count(l.data, "crm_contact_id", id), projects: count(p.data, "founder_contact_id", id) },
    }];
  });
}

export type MergeResult = { batchId: string; keptId: string; merged: number; moved: { ir_matches: number; lists: number; projects: number } };

export async function mergeContacts(input: { keepId: string; mergeIds: string[]; fields: Partial<Record<MergeField, string>>; by: string | null }): Promise<MergeResult> {
  const client = db();
  const before = await loadMergeCandidates([input.keepId, ...input.mergeIds]);
  const { data, error } = await client.rpc("merge_crm_contacts", { p_keep: input.keepId, p_merge: input.mergeIds, p_fields: input.fields, p_by: input.by });
  if (error) throw new Error(error.message);
  const res = data as MergeResult;
  // Matching reads a cached index: refresh the kept contact so /fit sees the merged values now.
  await reindexContacts([input.keepId]).catch(() => 0);
  const names = before.filter((c) => c.id !== input.keepId).map((c) => c.name || c.email || "contact").join(", ");
  await logActivity({ kind: "contact_edit", summary: `Merged ${res.merged} duplicate contact${res.merged === 1 ? "" : "s"} into this one: ${names}`, actorId: input.by, contactCrmId: input.keepId, meta: { mergeBatchId: res.batchId, mergedIds: input.mergeIds } });
  return res;
}

export async function undoMerge(batchId: string, by: string | null): Promise<{ keptId: string; restored: number }> {
  const client = db();
  const { data, error } = await client.rpc("undo_contact_merge", { p_batch: batchId });
  if (error) throw new Error(error.message);
  const res = data as { keptId: string; restored: number };
  const { data: rows } = await client.from("contact_merges").select("merged_id").eq("batch_id", batchId);
  await reindexContacts([res.keptId, ...((rows ?? []) as Array<{ merged_id: string }>).map((r) => r.merged_id)]).catch(() => 0);
  await logActivity({ kind: "contact_edit", summary: `Undid a merge: ${res.restored} contact${res.restored === 1 ? "" : "s"} restored`, actorId: by, contactCrmId: res.keptId, meta: { mergeBatchId: batchId } });
  return res;
}
