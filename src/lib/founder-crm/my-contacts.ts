import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listFounderInvestorContacts } from "@/lib/founder-crm/contacts";
import { contactSourceLabel, contactStatusLabel } from "@/lib/founder-crm/contact-labels";

export { contactSourceLabel, contactStatusLabel };

/**
 * The founder's own contact book for Stage 3 → My contacts.
 *
 * Two sources, both scoped to this founder and company:
 *  - founder_investor_contacts: people the founder imported or added (RLS, the
 *    founder's own rows);
 *  - intro_requests with status "facilitated": investors iCapOS introduced them
 *    to. Read with the service role, filtered to this company only.
 *
 * The iCapOS investor network itself is never listed here — introductions stay
 * brokered through iCFO — and introduced investors carry no contact details
 * (the introduction email already connected the two parties).
 */

export type { MyContactSource } from "@/lib/founder-crm/contact-labels";
import type { MyContactSource } from "@/lib/founder-crm/contact-labels";

export type MyContactRow = {
  id: string;
  kind: "contact" | "intro";
  name: string;
  firm: string | null;
  email: string | null;
  investorType: string | null;
  source: MyContactSource;
  status: string;
  sectors: string | null;
  addedAt: string;
};

type IntroRow = {
  id: string;
  investor_id: string | null;
  pipeline_investor_id: string | null;
  facilitated_at: string | null;
  updated_at: string;
};

export async function loadMyContacts(companyId: string, founderId: string): Promise<MyContactRow[]> {
  const supabase = await createServerSupabaseClient();
  const own = await listFounderInvestorContacts(supabase, founderId, companyId);
  const ownRows: MyContactRow[] = ("data" in own && own.data ? own.data : []).map((c) => ({
    id: c.id,
    kind: "contact",
    name: c.investor_name,
    firm: c.firm_name,
    email: c.email,
    investorType: c.investor_type,
    source: contactSourceLabel(c.source),
    status: contactStatusLabel(c.status),
    sectors: c.preferred_sectors,
    addedAt: c.created_at,
  }));

  const introRows: MyContactRow[] = [];
  try {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    const { data: intros } = await admin
      .from("intro_requests")
      .select("id, investor_id, pipeline_investor_id, facilitated_at, updated_at")
      .eq("company_id", companyId)
      .eq("status", "facilitated")
      .order("updated_at", { ascending: false })
      .limit(200);
    const list = (intros ?? []) as IntroRow[];
    const profileIds = [...new Set(list.map((i) => i.investor_id).filter((x): x is string => !!x))];
    const pipelineIds = [...new Set(list.map((i) => i.pipeline_investor_id).filter((x): x is string => !!x))];

    const [profiles, pipeline] = await Promise.all([
      profileIds.length
        ? admin.from("profiles").select("id, full_name").in("id", profileIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      pipelineIds.length
        ? admin.from("pipeline_investors").select("id, name, investor_type").in("id", pipelineIds)
        : Promise.resolve({ data: [] as { id: string; name: string; investor_type: string | null }[] }),
    ]);
    const profileName = new Map(((profiles.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
    const pipelineById = new Map(
      ((pipeline.data ?? []) as { id: string; name: string; investor_type: string | null }[]).map((p) => [p.id, p]),
    );

    for (const i of list) {
      const p = i.pipeline_investor_id ? pipelineById.get(i.pipeline_investor_id) : undefined;
      const name = p?.name ?? (i.investor_id ? profileName.get(i.investor_id) : null) ?? "Introduced investor";
      introRows.push({
        id: `intro:${i.id}`,
        kind: "intro",
        name,
        firm: null,
        email: null,
        investorType: p?.investor_type ?? (i.investor_id ? "Platform investor" : null),
        source: "Introduced",
        status: "Introduced",
        sectors: null,
        addedAt: i.facilitated_at ?? i.updated_at,
      });
    }
  } catch {
    // Introductions are additive; the founder's own contacts still load.
  }

  return [...introRows, ...ownRows];
}
