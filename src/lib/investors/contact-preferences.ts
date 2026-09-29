import type { SupabaseClient } from "@supabase/supabase-js";
import { getContactProfile } from "@/lib/sales/contacts";
import { groupContactProfile } from "@/lib/sales/contact-profile-sections";

export type InvestorPreference = { label: string; values: string[] };

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

/**
 * Load an investor's stated preferences from their CRM contact record, matched
 * by email (used only for the lookup — never shown to founders). Returns the
 * "Investor preferences" fields that actually have values. Empty when there's no
 * matched contact or no preferences on file.
 */
export async function loadInvestorPreferences(
  admin: unknown,
  email: string | null | undefined,
): Promise<InvestorPreference[]> {
  const e = email?.trim();
  if (!e) return [];

  const { data } = await loose(admin)
    .from("crm_contacts")
    .select("id")
    .ilike("email", e)
    .limit(1)
    .maybeSingle();
  const contactId = (data as { id?: string } | null)?.id;
  if (!contactId) return [];

  const profile = await getContactProfile(String(contactId));
  if (!profile) return [];

  const grouped = groupContactProfile(profile.contact.extra, profile.contact.membership);
  const section = grouped.sections.find((s) => s.title === "Investor thesis");
  if (!section) return [];

  return section.fields
    .filter((f) => f.values.length > 0)
    .map((f) => ({ label: f.label, values: f.values }));
}
