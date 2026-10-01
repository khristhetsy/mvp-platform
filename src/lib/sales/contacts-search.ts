/**
 * The ONE server-side entry to the Contacts search. Every endpoint that lists, counts,
 * groups or bulk-selects contacts goes through here, so they all run the same predicate
 * — built by the search_contacts SQL functions (migration 20260914003), never by string
 * concatenation into PostgREST URLs.
 *
 * Wire format from the client: `filter=<FilterSpec JSON>` plus groupBy/groupValue,
 * sort/dir, offset/limit. Legacy params (q, name, country, facet keys, group=) are
 * still accepted and folded into the spec so nothing that stored an old params string
 * (favorites, bulk selections) breaks.
 *
 * Errors are NOT swallowed: `must()` throws, callers return a 5xx with the message, and
 * the page shows it. A broken filter must never look like "no contacts".
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { reportDbError } from "@/lib/supabase/report";
import { isGroupBy } from "@/lib/sales/contact-grouping";
import type { Condition, FilterSpec } from "@/lib/sales/contact-filter-spec";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export const NONE = "__none__";
const ROLES = ["founder", "investor", "advisor", "other"] as const;
const SORTABLE = new Set(["name", "company", "email", "country", "created_on"]);
const FACET_KEYS = ["industries", "capital", "fundingStages", "investorTypes", "operatingStages"] as const;

export type ContactsQuery = {
  spec: FilterSpec;
  groupBy: string | null;
  groupValue: string | null;
  sort: string;
  dir: "asc" | "desc";
  offset: number;
  limit: number;
};

/** Throw on a Supabase error so it can't be mistaken for an empty result. */
export async function must<T>(p: PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>, context: string): Promise<T> {
  const { data, error } = await p;
  if (error) {
    reportDbError(context, error);
    throw new Error(`${context}: ${error.message ?? "database error"}`);
  }
  return data;
}

/**
 * Run a read-only query, retrying once if Postgres cancels it for the statement
 * timeout (57014). The database has short CPU stalls where a normally fast query
 * runs 50x slower; a second attempt a moment later almost always succeeds.
 */
async function readWithRetry<T>(run: () => PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>, context: string): Promise<T> {
  const first = await run();
  if (first.error?.code === "57014") {
    await new Promise((resolve) => setTimeout(resolve, 750));
    return must(run(), context);
  }
  return must(Promise.resolve(first), context);
}

/** Client params → one query. Old-style params are folded into the spec. */
export function parseContactsQuery(p: URLSearchParams): ContactsQuery {
  const conditions: Condition[] = [];
  let match: FilterSpec["match"] = "all";

  const specRaw = p.get("filter");
  if (specRaw) {
    try {
      const s = JSON.parse(specRaw) as FilterSpec;
      if (s && Array.isArray(s.conditions)) { conditions.push(...s.conditions); if (s.match === "any") match = "any"; }
      else throw new Error("filter is not a spec");
    } catch (err) {
      // A malformed spec used to be ignored (→ the whole table). Make it an error instead.
      throw new Error(`Invalid filter: ${err instanceof Error ? err.message : "unreadable"}`);
    }
  }
  const q = p.get("q")?.trim();
  if (q) conditions.push({ field: "q", op: "contains", value: q });
  for (const col of ["name", "company", "email", "phone"] as const) {
    const v = p.get(col)?.trim();
    if (v) conditions.push({ field: col, op: "contains", value: v });
  }
  // Legacy country param is comma-joined (which broke "Korea, Republic of"); new clients
  // send it inside the spec. Keep the split for old stored strings only.
  const countries = p.get("country")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (countries?.length) conditions.push({ field: "country", op: "in", value: countries });
  const leadSources = p.getAll("leadSource").map((s) => s.trim()).filter(Boolean);
  if (leadSources.length) conditions.push({ field: "leadSource", op: "in", value: leadSources });
  for (const key of FACET_KEYS) {
    const vals = p.getAll(key).map((s) => s.trim()).filter(Boolean);
    if (vals.length) conditions.push({ field: key, op: "in", value: vals });
  }

  // Group selectors. `group=<role>` is the profile dimension's bucket.
  let groupBy: string | null = null;
  let groupValue: string | null = null;
  const gb = p.get("groupBy");
  const gv = p.get("groupValue");
  if (gb && isGroupBy(gb) && gv != null) { groupBy = gb; groupValue = gv; }
  const role = p.get("group");
  if (role && (ROLES as readonly string[]).includes(role)) {
    if (groupBy && groupBy !== "profile") {
      // Role narrows a non-profile grouping ("Investors grouped by industry").
      conditions.push({ field: "type", op: "in", value: [role] });
    } else { groupBy = "profile"; groupValue = role; }
  }

  const sortRaw = p.get("sort") ?? "name";
  return {
    spec: { match, conditions },
    groupBy, groupValue,
    sort: SORTABLE.has(sortRaw) ? sortRaw : "name",
    dir: p.get("dir") === "desc" ? "desc" : "asc",
    offset: Math.max(0, Number(p.get("offset") ?? 0) || 0),
    limit: Math.min(200, Math.max(1, Number(p.get("limit") ?? 50) || 50)),
  };
}

export type ContactRow = {
  id: string; name: string | null; email: string | null; company: string | null; phone: string | null;
  source: string | null; external_id: string | null; contact_type: string | null; country: string | null;
  created_on: string | null; synced_at: string | null; assignee_ids: string[] | null;
  raw_phone: string | null; raw_mobile: string | null; ls_profile: string | null; ls_override: string | null;
  total: number;
};

/**
 * One page of contacts. `total` is the exact count for the predicate when `count` is
 * true, else -1 (unknown). The list page passes false: its group headers already carry
 * the exact count from count_contact_buckets, and counting again per page walks every
 * matching row (2.6 s for 7k Investors on the production instance).
 */
export async function searchContacts(q: ContactsQuery, owner: string | null, count = true): Promise<{ rows: ContactRow[]; total: number }> {
  const rows = await readWithRetry<ContactRow[] | null>(() => db().rpc("search_contacts", {
    p_spec: q.spec, p_owner: owner, p_group_by: q.groupBy, p_group_value: q.groupValue,
    p_sort: q.sort, p_dir: q.dir, p_offset: q.offset, p_limit: q.limit, p_count: count,
  }), "search_contacts");
  const list = (rows ?? []).map((r) => ({ ...r, total: Number(r.total) }));
  return { rows: list, total: count ? (list[0]?.total ?? 0) : -1 };
}

/** Bucket counts for one dimension over the same predicate (Unassigned = NONE, last). */
export async function countContactBuckets(spec: FilterSpec, owner: string | null, groupBy: string): Promise<Array<{ value: string; count: number }>> {
  const rows = await readWithRetry<Array<{ value: string; n: number | string }> | null>(
    () => db().rpc("count_contact_buckets", { p_spec: spec, p_owner: owner, p_group_by: groupBy }), "count_contact_buckets");
  return (rows ?? []).map((r) => ({ value: r.value, count: Number(r.n) }));
}

/** Rows PostgREST returns per request (Supabase max rows); larger sets are read in pages. */
export const ID_PAGE = 1000;

/**
 * Every matching id — what "Select all N" acts on. Capped at 25,000.
 * Read in pages of ID_PAGE: PostgREST returns at most 1,000 rows per request, so a
 * single call silently stopped every "Select all" bulk action (lists, lead assign,
 * lead source, email, export) at the first 1,000 contacts. search_contact_ids orders
 * by id, so the pages are stable and never overlap.
 */
export async function searchContactIds(spec: FilterSpec, owner: string | null, groupBy: string | null, groupValue: string | null, limit = 25000): Promise<string[]> {
  const cap = Math.min(Math.max(limit, 1), 25000);
  const args = { p_spec: spec, p_owner: owner, p_group_by: groupBy, p_group_value: groupValue, p_limit: cap };
  const out: string[] = [];
  for (let from = 0; from < cap; from += ID_PAGE) {
    const to = Math.min(from + ID_PAGE, cap) - 1;
    const rows = await readWithRetry<Array<string | { search_contact_ids: string }> | null>(
      () => db().rpc("search_contact_ids", args).range(from, to), "search_contact_ids");
    // PostgREST returns a setof scalar as [{search_contact_ids: uuid}] (or bare strings in some versions).
    const page = (rows ?? []).map((r) => (typeof r === "string" ? r : r.search_contact_ids));
    out.push(...page);
    if (page.length < to - from + 1) break;
  }
  return out;
}
