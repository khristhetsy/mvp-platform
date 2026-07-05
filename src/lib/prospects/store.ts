// Marketing Hub · Prospects wizard — data store. Overview counts for the Import
// step, iCapOS-signup import, and the filterable Contact List. All over the one
// deduped crm_contacts store.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { importParsedRows } from "@/lib/contacts/importFile";
import type { ParsedContact } from "@/lib/contacts/types";

export interface RecentManual {
  id: string;
  name: string | null;
  email: string | null;
  side: string | null;
  company: string | null;
}

export interface ImportOverview {
  founders: number;
  investors: number;
  unclassified: number;
  total: number;
  odoo: number;
  manual: number;
  file: number;
  signupsAvailable: number;
  recentManual: RecentManual[];
}

async function c(build: (db: ReturnType<typeof serviceRoleClientUntyped>) => PromiseLike<{ count: number | null }>): Promise<number> {
  const db = serviceRoleClientUntyped();
  const { count } = await build(db);
  return count ?? 0;
}

export async function getImportOverview(): Promise<ImportOverview> {
  const db = serviceRoleClientUntyped();
  const [founders, investors, unclassified, total, odoo, manual, file, signupProfiles, linked, recent] = await Promise.all([
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true }).eq("side", "founder")),
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true }).eq("side", "investor")),
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true }).is("side", null)),
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true })),
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true }).eq("source", "odoo")),
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true }).eq("source", "manual")),
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true }).in("source", ["csv", "xlsx", "vcard"])),
    c((d) => d.from("profiles").select("id", { count: "exact", head: true }).in("role", ["founder", "investor"])),
    c((d) => d.from("crm_contacts").select("id", { count: "exact", head: true }).not("supabase_profile_id", "is", null)),
    db.from("crm_contacts").select("id, name, email, side, company").eq("source", "manual").order("synced_at", { ascending: false }).limit(5),
  ]);

  return {
    founders,
    investors,
    unclassified,
    total,
    odoo,
    manual,
    file,
    signupsAvailable: Math.max(0, signupProfiles - linked),
    recentManual: ((recent.data ?? []) as RecentManual[]),
  };
}

/** Pull iCapOS platform signups (founder/investor profiles) into the mirror. */
export async function importSignups(limit = 500): Promise<{ imported: number; merged: number }> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["founder", "investor"])
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows: ParsedContact[] = ((data ?? []) as Array<{ full_name: string | null; email: string | null; role: string }>)
    .filter((p) => p.email)
    .map((p) => ({
      email: p.email,
      name: p.full_name,
      side: p.role === "founder" || p.role === "investor" ? p.role : null,
    }));

  const result = await importParsedRows(rows, "icapos");
  return { imported: result.inserted, merged: result.merged };
}

export interface ListRow {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  side: string | null;
  segment: string | null;
  email_status: string | null;
  lead_status: string | null;
  lead_prescore: number | null;
  source: string | null;
  phone: string | null;
}

export interface ContactListResult {
  rows: ListRow[];
  total: number;
}

export interface ListFilters {
  side?: string;
  segment?: string;
  status?: string;
  leadStatus?: string;
  search?: string;
  ids?: string[];
  limit?: number;
  offset?: number;
}

export async function getContactList(filters: ListFilters): Promise<ContactListResult> {
  const db = serviceRoleClientUntyped();
  let q = db
    .from("crm_contacts")
    .select("id, name, email, company, side, segment, email_status, lead_status, lead_prescore, source, phone", { count: "exact" })
    .eq("suppressed", false)
    .order("lead_prescore", { ascending: false, nullsFirst: false });

  // Scope to a specific set of contacts (e.g. the selection carried from Create List).
  if (filters.ids && filters.ids.length > 0) q = q.in("id", filters.ids.slice(0, 1000));
  if (filters.side) q = q.eq("side", filters.side);
  if (filters.segment) q = q.eq("segment", filters.segment);
  if (filters.status) q = q.eq("email_status", filters.status);
  if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
  if (filters.search) q = q.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, count } = await q;
  return { rows: (data ?? []) as ListRow[], total: count ?? 0 };
}

/** All rows for the given filters, for CSV export (bounded). */
export async function getContactsForExport(filters: ListFilters, cap = 10000): Promise<ListRow[]> {
  const { rows } = await getContactList({ ...filters, limit: cap, offset: 0 });
  return rows;
}
