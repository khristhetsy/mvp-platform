/**
 * Paged reads for tables bigger than PostgREST's row cap.
 *
 * `.limit(20000)` does NOT lift Supabase's `db-max-rows` (1000 by default): the request
 * succeeds and silently returns the first 1000 rows. Any scan over a table that can
 * exceed 1000 rows must page instead, or it quietly operates on a fraction of the data —
 * which is exactly how /fit came to rank against 1,000 of 7,184 investors.
 *
 * Pure paging logic only; the caller supplies the query.
 */

import { reportDbError } from "@/lib/supabase/report";

/** Default page size — matches the common db-max-rows so one request fills a page. */
export const PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PagedQuery = (from: number, to: number) => PromiseLike<{ data: any; error: any }>;

/**
 * Read every row by paging with .range() until a short page comes back.
 *
 * The query MUST carry a stable .order() — without one Postgres may return rows in a
 * different order per page, which silently duplicates and skips records.
 *
 * Stops early on error (returning what it has) rather than throwing, matching how these
 * call sites already degrade. `max` is a safety valve against an unbounded loop.
 */
export async function readAllRows<T>(
  makeQuery: PagedQuery,
  opts: { page?: number; max?: number; context?: string } = {},
): Promise<T[]> {
  const page = opts.page ?? PAGE_SIZE;
  const max = opts.max ?? 100_000;
  const out: T[] = [];
  for (let from = 0; from < max; from += page) {
    const { data, error } = await makeQuery(from, from + page - 1);
    // Stopping silently on error made a broken query look like a short final page — i.e.
    // like a complete read. Report it, then stop.
    if (reportDbError(`${opts.context ?? "readAllRows"} (rows ${from}-${from + page - 1})`, error)) break;
    if (error) break;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < page) break;   // short page = last page
  }
  return out;
}

/**
 * Split a list into chunks. `.in("id", ids)` becomes a URL query string, so a few
 * thousand ids produce a request long enough to be rejected (HTTP 414). Uncapping the
 * reads above makes these id lists much larger, so they have to be chunked.
 */
export function chunk<T>(items: T[], size = 500): T[][] {
  if (size < 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
