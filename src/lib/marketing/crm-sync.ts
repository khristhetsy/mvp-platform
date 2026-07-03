// One-way sync: push imported CRM contacts (crm_contacts, the Odoo mirror) into
// the Marketing Hub's contact list (marketing_contacts). Upserts on email, so
// re-running is safe, additive, and cleans up bad values. Batched for the ~22K set.

import { marketingDb } from "@/lib/marketing/db";

function splitName(name: string | null): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export interface CrmSyncPage {
  synced: number;
  total: number;
  nextOffset: number;
  done: boolean;
}

export async function syncCrmToMarketing(offset: number, limit = 500): Promise<CrmSyncPage> {
  const db = marketingDb();
  const { data, count } = await db
    .from("crm_contacts")
    .select("name, email, company, raw", { count: "exact" })
    .eq("source", "odoo")
    .not("email", "is", null)
    .order("synced_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const source = (data ?? []) as { name: string | null; email: string | null; company: string | null; raw: Record<string, unknown> | null }[];

  // De-dupe by email within the batch — the upsert can't touch the same email twice in one statement.
  const seen = new Set<string>();
  const rows = source
    .filter((r) => r.email && r.email.includes("@"))
    .filter((r) => {
      const key = (r.email as string).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => {
      const email = r.email as string;
      // Don't let an email masquerade as a name or company (some Odoo rows store it that way).
      const nameIsEmail = (r.name ?? "").includes("@");
      const { first, last } = nameIsEmail ? { first: "", last: "" } : splitName(r.name);
      const companyRaw = (r.company ?? "").trim();
      const companyBad = !companyRaw || companyRaw.includes("@") || companyRaw.toLowerCase() === email.toLowerCase();
      const title = ((r.raw ?? {}).function as string) || null;
      return {
        email,
        first_name: first || null,
        last_name: last || null,
        company: companyBad ? null : companyRaw,
        title,
        source: "iCapOS CRM (Odoo)",
      };
    });

  let imported = 0;
  if (rows.length) {
    const { error } = await db.from("marketing_contacts").upsert(rows, { onConflict: "email" });
    if (error) throw new Error(error.message);
    imported = rows.length;
  }

  const total = count ?? 0;
  const advanced = source.length;
  const nextOffset = offset + advanced;
  return { synced: imported, total, nextOffset, done: advanced === 0 || nextOffset >= total };
}
