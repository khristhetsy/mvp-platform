// Marketing Hub · Prospects — filter → count → save as a Contact List.
// Static snapshot: saving assigns the contacts matching the filters *now* into a
// Marketing Hub list (marketing_lists + marketing_list_contacts), so Campaigns
// can target the slice. Backed by the crm_contacts pipeline; bridged by email.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { splitName } from "@/lib/contacts/types";

export interface ProspectFilters {
  side?: string;        // founder | investor
  segment?: string;     // hot | warm | cold
  status?: string;      // valid | risky | invalid | unverified
  leadStatus?: string;  // new | contacted | engaged | qualified | nurturing | converted | disqualified
  source?: string;      // odoo | manual | csv | icapos | ...
  minScore?: number;    // lead_prescore >=
  sector?: string;      // signals->>sector ilike
  search?: string;
  ids?: string[];       // restrict to an explicit contact-id subset
}

// The untyped service client yields loosely-typed builders; keep it simple.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FB = any;

function applyFilters(q: FB, f: ProspectFilters, opts?: { skipSegment?: boolean; skipStatus?: boolean }): FB {
  let out = q.eq("suppressed", false).not("email", "is", null);
  if (f.ids && f.ids.length > 0) out = out.in("id", f.ids);
  if (f.side) out = out.eq("side", f.side);
  if (f.segment && !opts?.skipSegment) out = out.eq("segment", f.segment);
  if (f.status && !opts?.skipStatus) out = out.eq("email_status", f.status);
  if (f.leadStatus) out = out.eq("lead_status", f.leadStatus);
  if (f.source) out = out.eq("source", f.source);
  if (typeof f.minScore === "number" && f.minScore > 0) out = out.gte("lead_prescore", f.minScore);
  if (f.sector) out = out.filter("signals->>sector", "ilike", `%${f.sector}%`);
  if (f.search) out = out.or(`name.ilike.%${f.search}%,email.ilike.%${f.search}%,company.ilike.%${f.search}%`);
  return out;
}

export interface MatchCounts {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  valid: number;
}

export async function countMatches(f: ProspectFilters): Promise<MatchCounts> {
  const db = serviceRoleClientUntyped();
  const head = () => db.from("crm_contacts").select("id", { count: "exact", head: true });
  const [total, hot, warm, cold, valid] = await Promise.all([
    applyFilters(head(), f),
    applyFilters(head(), f, { skipSegment: true }).eq("segment", "hot"),
    applyFilters(head(), f, { skipSegment: true }).eq("segment", "warm"),
    applyFilters(head(), f, { skipSegment: true }).eq("segment", "cold"),
    applyFilters(head(), f, { skipStatus: true }).eq("email_status", "valid"),
  ]);
  const n = (r: { count: number | null }) => r.count ?? 0;
  return { total: n(await total), hot: n(await hot), warm: n(await warm), cold: n(await cold), valid: n(await valid) };
}

const SAVE_CAP = 20000;
const PAGE = 1000;

export interface SaveResult {
  listId: string;
  listName: string;
  added: number;
}

/** Save the filtered matches into a list (new or existing). Static snapshot. */
export async function saveMatchesToList(
  f: ProspectFilters,
  target: { listId?: string; name?: string },
): Promise<SaveResult> {
  const db = serviceRoleClientUntyped();

  // Resolve the target list.
  let listId = target.listId ?? null;
  let listName = "";
  if (listId) {
    const { data } = await db.from("marketing_lists").select("id, name").eq("id", listId).single();
    if (!data) throw new Error("List not found.");
    listName = data.name as string;
  } else {
    const name = (target.name ?? "").trim();
    if (!name) throw new Error("A list name is required.");
    const { data, error } = await db.from("marketing_lists").insert({ name }).select("id, name").single();
    if (error || !data) throw new Error(error?.message ?? "Could not create list.");
    listId = data.id as string;
    listName = data.name as string;
  }

  let added = 0;
  for (let offset = 0; offset < SAVE_CAP; offset += PAGE) {
    const { data } = await applyFilters(db.from("crm_contacts").select("id, name, email, company"), f)
      .order("lead_prescore", { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE - 1);
    const rows = (data ?? []) as Array<{ email: string | null; name: string | null; company: string | null }>;
    if (rows.length === 0) break;

    // Dedupe emails in this page, upsert into marketing_contacts, get ids.
    const seen = new Set<string>();
    const mc = rows
      .filter((r) => r.email && !seen.has(r.email.toLowerCase()) && seen.add(r.email.toLowerCase()))
      .map((r) => {
        const { first, last } = splitName(r.name);
        return { email: (r.email as string).toLowerCase(), first_name: first, last_name: last, company: r.company, source: "Prospect list" };
      });
    if (mc.length === 0) { if (rows.length < PAGE) break; continue; }

    const { data: upserted } = await db.from("marketing_contacts").upsert(mc, { onConflict: "email" }).select("id");
    const memberships = ((upserted ?? []) as Array<{ id: string }>).map((c) => ({ list_id: listId, contact_id: c.id }));
    if (memberships.length > 0) {
      await db.from("marketing_list_contacts").upsert(memberships, { onConflict: "list_id,contact_id" });
      added += memberships.length;
    }
    if (rows.length < PAGE) break;
  }

  return { listId: listId as string, listName, added };
}
