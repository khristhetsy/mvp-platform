// Source-agnostic sync engine. Backfill runs in bounded, resumable batches
// (timeout-safe on serverless); delta pulls only records changed since last run.

import { getSource } from "@/lib/crm-connectors/registry";
import { countMirror, getSyncState, setSyncState, upsertContacts } from "@/lib/crm-connectors/mirror";

export type ImportResult = {
  imported: number;
  done: boolean;
  cursor: string | null;
  mirrorTotal: number;
  sourceTotal: number;
};

/**
 * Import up to `maxContacts` from the source, resuming from the saved cursor.
 * Call repeatedly (client loops) until `done`; each call is bounded so it never
 * exceeds a serverless timeout.
 */
export async function importBatch(
  sourceId: string,
  opts: { maxContacts?: number; pageSize?: number; restart?: boolean } = {},
): Promise<ImportResult> {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (!source.isConfigured()) throw new Error(`${source.label} is not configured.`);

  const maxContacts = opts.maxContacts ?? 2000;
  const pageSize = opts.pageSize ?? 200;
  const state = await getSyncState(sourceId);
  let cursor = opts.restart ? null : state?.last_cursor ?? null;

  let imported = 0;
  try {
    while (imported < maxContacts) {
      const page = await source.fetchPage(cursor, pageSize);
      imported += await upsertContacts(page.contacts);
      cursor = page.nextCursor;
      await setSyncState(sourceId, { last_cursor: cursor, last_error: null });
      if (!cursor) break;
    }
  } catch (err) {
    await setSyncState(sourceId, { last_error: err instanceof Error ? err.message : "import failed" });
    throw err;
  }

  const done = cursor === null;
  const [{ total: mirrorTotal }, srcTest] = await Promise.all([countMirror(sourceId), source.test()]);
  await setSyncState(sourceId, {
    total_imported: mirrorTotal,
    ...(done ? { last_full_import_at: new Date().toISOString(), last_cursor: null } : {}),
  });

  return { imported, done, cursor, mirrorTotal, sourceTotal: srcTest.count };
}

/** Incremental sync: upsert everything changed since the last delta/full run. */
export async function syncDelta(sourceId: string): Promise<{ synced: number }> {
  const source = getSource(sourceId);
  if (!source || !source.isConfigured()) return { synced: 0 };

  const state = await getSyncState(sourceId);
  const since =
    state?.last_delta_at ??
    state?.last_full_import_at ??
    new Date(Date.now() - 7 * 86_400_000).toISOString();

  try {
    const contacts = await source.fetchDelta(since);
    const synced = await upsertContacts(contacts);
    await setSyncState(sourceId, { last_delta_at: new Date().toISOString(), last_error: null });
    return { synced };
  } catch (err) {
    await setSyncState(sourceId, { last_error: err instanceof Error ? err.message : "delta failed" });
    throw err;
  }
}
