/**
 * Reading the option lists.
 *
 * Never throws and never returns nothing: an empty table, a failed query or a
 * migration that has not been applied all fall back to the code lists, because
 * a registration form that renders no options is worse than one showing the
 * set that shipped.
 */
import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  CODE_FALLBACK,
  VOCABULARY_LISTS,
  type Vocabularies,
  type VocabularyList,
  type VocabularyOption,
} from "@/lib/vocabulary/lists";

type Row = { list: string; slug: string; label: string; archived: boolean; sort_order: number; description?: string | null };

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/**
 * Every list, in one read.
 *
 * One query rather than nine: the whole table is a few hundred rows, and a
 * page that renders three pickers should not make three round trips.
 */
export const loadVocabularies = cache(async (): Promise<Vocabularies> => {
  const out: Vocabularies = { ...CODE_FALLBACK };
  try {
    const { data, error } = await raw()
      .from("vocabulary_options")
      .select("list, slug, label, archived, sort_order, description")
      .order("sort_order", { ascending: true });

    if (error || !data?.length) return out;

    const byList = new Map<string, VocabularyOption[]>();
    for (const r of data as Row[]) {
      const bucket = byList.get(r.list) ?? [];
      bucket.push({ slug: r.slug, label: r.label, archived: Boolean(r.archived), description: r.description ?? null });
      byList.set(r.list, bucket);
    }

    for (const list of VOCABULARY_LISTS) {
      const rows = byList.get(list);
      // A list the table has nothing to say about keeps its code values, so a
      // partially-seeded table cannot empty a picker.
      if (rows?.length) out[list] = rows;
    }
    return out;
  } catch {
    return out;
  }
});

/** One list, for a caller that only needs the one. */
export async function loadVocabulary(list: VocabularyList): Promise<VocabularyOption[]> {
  return (await loadVocabularies())[list];
}
