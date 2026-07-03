// One-way sync: push imported CRM contacts (crm_contacts, the Odoo mirror) into
// the Marketing Hub's contact list (marketing_contacts). Upserts on email, so
// re-running is safe and additive. Batched for the ~22K set.

import { marketingDb } from "@/lib/marketing/db";
import { importContacts } from "@/lib/marketing/contacts";

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
  const rows = source
    .filter((r) => r.email && r.email.includes("@"))
    .map((r) => {
      const { first, last } = splitName(r.name);
      const rawObj = r.raw ?? {};
      return {
        email: r.email as string,
        first_name: first || undefined,
        last_name: last || undefined,
        company: r.company ?? undefined,
        title: (rawObj.function as string) || undefined,
        source: "iCapOS CRM (Odoo)",
      };
    });

  const { imported } = rows.length ? await importContacts(rows) : { imported: 0 };
  const total = count ?? 0;
  const advanced = source.length;
  const nextOffset = offset + advanced;
  return { synced: imported, total, nextOffset, done: advanced === 0 || nextOffset >= total };
}
