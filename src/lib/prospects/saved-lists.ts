// Marketing Hub · Prospects — the saved contact lists directory (Step 4) and the
// export rows behind Step 5. Lists live in marketing_lists + marketing_list_contacts;
// contacts are the deduped marketing_contacts snapshot, enriched on read by joining
// crm_contacts on email for the pipeline columns (lead status, score, phone, …).

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export interface SavedList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  archived: boolean;
  contact_count: number;
}

export interface PreviewRow {
  name: string | null;
  email: string | null;
  company: string | null;
}

export interface ListDetail extends SavedList {
  preview: PreviewRow[];
}

/** All saved lists (newest first), with contact counts. Archived hidden by default. */
export async function getSavedLists(includeArchived = false): Promise<SavedList[]> {
  const db = serviceRoleClientUntyped();
  let q = db.from("marketing_lists").select("id, name, description, created_at, archived").order("created_at", { ascending: false });
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q;
  const lists = (data ?? []) as Row[];
  return Promise.all(
    lists.map(async (l) => {
      const { count } = await db.from("marketing_list_contacts").select("contact_id", { count: "exact", head: true }).eq("list_id", l.id);
      return { id: l.id, name: l.name, description: l.description ?? null, created_at: l.created_at, archived: !!l.archived, contact_count: count ?? 0 };
    }),
  );
}

/** One list with a small contact preview. */
export async function getListDetail(listId: string, previewLimit = 25): Promise<ListDetail | null> {
  const db = serviceRoleClientUntyped();
  const { data: list } = await db.from("marketing_lists").select("id, name, description, created_at, archived").eq("id", listId).maybeSingle();
  if (!list) return null;

  const { count } = await db.from("marketing_list_contacts").select("contact_id", { count: "exact", head: true }).eq("list_id", listId);
  const { data: mem } = await db.from("marketing_list_contacts").select("contact_id").eq("list_id", listId).limit(previewLimit);
  const ids = ((mem ?? []) as Row[]).map((m) => m.contact_id);

  let preview: PreviewRow[] = [];
  if (ids.length > 0) {
    const { data: contacts } = await db.from("marketing_contacts").select("name, email, company, first_name, last_name").in("id", ids);
    preview = ((contacts ?? []) as Row[]).map((c) => ({
      name: c.name ?? ([c.first_name, c.last_name].filter(Boolean).join(" ") || null),
      email: c.email ?? null,
      company: c.company ?? null,
    }));
  }

  return { id: list.id, name: list.name, description: list.description ?? null, created_at: list.created_at, archived: !!list.archived, contact_count: count ?? 0, preview };
}

export interface ApproachRow {
  id: string;                 // crm_contacts.id (for scoring)
  name: string | null;
  email: string | null;
  company: string | null;
  side: string | null;
  segment: string | null;
  lead_prescore: number | null;
  lead_status: string | null;
  email_status: string | null;
  phone: string | null;
  approach: Record<string, unknown> | null;
}

/** A saved list's contacts joined to crm_contacts (for Step 3 AI Approach). Bounded. */
export async function getListApproachRows(listId: string, limit = 200): Promise<ApproachRow[]> {
  const db = serviceRoleClientUntyped();
  const { data: mem } = await db.from("marketing_list_contacts").select("contact_id").eq("list_id", listId).limit(limit);
  const ids = ((mem ?? []) as Row[]).map((m) => m.contact_id);
  if (ids.length === 0) return [];

  // marketing_contacts → emails
  const emails: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("marketing_contacts").select("email").in("id", ids.slice(i, i + 200));
    for (const r of (data ?? []) as Row[]) if (r.email) emails.push(String(r.email).toLowerCase());
  }
  if (emails.length === 0) return [];

  // crm_contacts by email
  const out: ApproachRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await db
      .from("crm_contacts")
      .select("id, name, email, company, side, segment, lead_prescore, lead_status, email_status, phone, approach")
      .in("email", emails.slice(i, i + 200));
    for (const r of (data ?? []) as Row[]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        id: r.id, name: r.name ?? null, email: r.email ?? null, company: r.company ?? null,
        side: r.side ?? null, segment: r.segment ?? null, lead_prescore: r.lead_prescore ?? null,
        lead_status: r.lead_status ?? null, email_status: r.email_status ?? null, phone: r.phone ?? null,
        approach: (r.approach ?? null) as Record<string, unknown> | null,
      });
    }
  }
  out.sort((a, b) => (b.lead_prescore ?? -1) - (a.lead_prescore ?? -1));
  return out;
}

export async function renameList(listId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("A name is required.");
  await serviceRoleClientUntyped().from("marketing_lists").update({ name: clean, updated_at: new Date().toISOString() }).eq("id", listId);
}

export async function setListArchived(listId: string, archived: boolean): Promise<void> {
  await serviceRoleClientUntyped().from("marketing_lists").update({ archived, updated_at: new Date().toISOString() }).eq("id", listId);
}

// ---- Export ------------------------------------------------------------------

export const EXPORT_COLUMNS = ["name", "email", "company", "source", "side", "segment", "email_status", "lead_status", "lead_prescore", "phone"] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];
const CRM_COLUMNS: ReadonlySet<string> = new Set(["side", "segment", "email_status", "lead_status", "lead_prescore", "phone"]);
const EXPORT_CAP = 20000;
const PAGE = 1000;
const CHUNK = 200;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export interface ExportResult {
  listName: string;
  columns: ExportColumn[];
  rows: Array<Record<string, string | number | null>>;
}

/** Rows for a saved list with the requested columns (enriched from crm_contacts by email). */
export async function getListExportRows(listId: string, requested: string[]): Promise<ExportResult> {
  const db = serviceRoleClientUntyped();
  const { data: list } = await db.from("marketing_lists").select("name").eq("id", listId).maybeSingle();
  if (!list) throw new Error("List not found.");

  const columns = (requested.filter((c) => (EXPORT_COLUMNS as readonly string[]).includes(c)) as ExportColumn[]);
  const cols: ExportColumn[] = columns.length > 0 ? columns : ["name", "email", "company"];

  // 1) member contact ids (paged)
  const ids: string[] = [];
  for (let offset = 0; offset < EXPORT_CAP; offset += PAGE) {
    const { data } = await db.from("marketing_list_contacts").select("contact_id").eq("list_id", listId).range(offset, offset + PAGE - 1);
    const page = ((data ?? []) as Row[]).map((m) => m.contact_id);
    ids.push(...page);
    if (page.length < PAGE) break;
  }

  // 2) marketing_contacts snapshot rows
  const mc = new Map<string, Row>();
  for (const c of chunk(ids, CHUNK)) {
    const { data } = await db.from("marketing_contacts").select("id, name, first_name, last_name, email, company, source").in("id", c);
    for (const r of (data ?? []) as Row[]) mc.set(r.id, r);
  }

  // 3) crm_contacts enrichment by email, only if a crm column was requested
  const crm = new Map<string, Row>();
  if (cols.some((c) => CRM_COLUMNS.has(c))) {
    const emails = [...mc.values()].map((r) => (r.email ?? "").toLowerCase()).filter(Boolean);
    for (const c of chunk([...new Set(emails)], CHUNK)) {
      const { data } = await db.from("crm_contacts").select("email, side, segment, email_status, lead_status, lead_prescore, phone").in("email", c);
      for (const r of (data ?? []) as Row[]) if (r.email) crm.set(String(r.email).toLowerCase(), r);
    }
  }

  const rows = ids.map((id) => {
    const m = mc.get(id) ?? {};
    const email = (m.email ?? null) as string | null;
    const e = email ? crm.get(email.toLowerCase()) ?? {} : {};
    const name = m.name ?? ([m.first_name, m.last_name].filter(Boolean).join(" ") || null);
    const pick: Record<string, string | number | null> = {};
    for (const c of cols) {
      pick[c] =
        c === "name" ? name :
        c === "email" ? email :
        c === "company" ? (m.company ?? null) :
        c === "source" ? (m.source ?? null) :
        (e[c] ?? null);
    }
    return pick;
  }).filter((r) => Object.values(r).some((v) => v !== null && v !== ""));

  return { listName: list.name as string, columns: cols, rows };
}
