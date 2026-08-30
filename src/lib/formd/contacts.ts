/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

// The Contacts page shows records that were promoted OUT of the Form D desk —
// investors land in prospect_investors (source 'SEC Form D'), founders land in
// crm_contacts (source 'formd'). This unions both into one list the page renders.

export type FormdContactKind = "investor" | "founder";

export type FormdContact = {
  id: string;
  kind: FormdContactKind;
  name: string;
  subtitle: string | null; // location for investors, company for founders
  status: string | null;
  addedAt: string | null;
};

export async function listFormdPromotedContacts(client: SupabaseClient): Promise<FormdContact[]> {
  const db = client as unknown as SupabaseClient<any>;
  const out: FormdContact[] = [];

  const { data: investors } = await db
    .from("prospect_investors")
    .select("id, name, state_or_country, status, created_at")
    .eq("source", "SEC Form D")
    .order("created_at", { ascending: false })
    .limit(5000);
  for (const r of (investors ?? []) as any[]) {
    out.push({
      id: `inv:${r.id}`,
      kind: "investor",
      name: String(r.name ?? "—"),
      subtitle: r.state_or_country ?? null,
      status: r.status ?? null,
      addedAt: r.created_at ?? null,
    });
  }

  const { data: founders } = await db
    .from("crm_contacts")
    .select("id, name, company, lead_status, synced_at")
    .eq("source", "formd")
    .order("synced_at", { ascending: false })
    .limit(5000);
  for (const r of (founders ?? []) as any[]) {
    out.push({
      id: `fnd:${r.id}`,
      kind: "founder",
      name: String(r.name ?? "—"),
      subtitle: r.company ?? null,
      status: r.lead_status ?? null,
      addedAt: r.synced_at ?? null,
    });
  }

  out.sort((a, b) => {
    if (!a.addedAt || !b.addedAt) return 0;
    return a.addedAt < b.addedAt ? 1 : -1;
  });
  return out;
}
