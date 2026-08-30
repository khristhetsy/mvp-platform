/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// When an investor firm is promoted into the distribution list (prospect_investors),
// also mirror it into crm_contacts as an Investor so it appears on the Sales Hub
// Contacts page next to promoted founders. module='investor' → the generated
// contact_type lands it in the Investors group; assignee_ids makes it visible in
// the owner-scoped view. Keyed on (source, external_id) so a re-promote is a no-op.
// crm_contacts is service-role only (PII), so this uses the admin client regardless
// of the caller. Best-effort: a mirror failure must not fail the promote.
export async function mirrorInvestorToContacts(firmId: string, actorId: string): Promise<void> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;
  const { data: firm } = await admin
    .from("formd_firms")
    .select("display_name, city, state_or_country, phone, domain")
    .eq("id", firmId)
    .maybeSingle();
  if (!firm) return;
  await admin.from("crm_contacts").upsert(
    {
      source: "formd",
      external_id: `formd-firm:${firmId}`,
      module: "investor",
      side: "investor",
      name: firm.display_name,
      company: firm.display_name,
      phone: firm.phone ?? null,
      website: firm.domain ?? null,
      lead_status: "new",
      tags: ["SEC Form D", "Investor"],
      overrides: {
        lead_source: "SEC Form D",
        membership: "Investor",
        city: firm.city,
        state: firm.state_or_country,
        country: "United States",
      },
      assignee_ids: [actorId],
    },
    { onConflict: "source,external_id" },
  );
}
