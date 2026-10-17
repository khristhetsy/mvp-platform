import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getManualRecipients, type ManualRecipientStatus } from "@/lib/outreach/manual-outreach";
import type { FounderInvestorContactRecord } from "@/lib/founder-crm/types";

/**
 * One of the founder's own contacts, for the full contact page (Stage 3 →
 * My contacts → a name). Scoped to this founder and company; an archived or
 * foreign id returns null, so the page 404s rather than leaking a row.
 *
 * Also returns where the contact sits in the founder's list (for the Prev /
 * Next pager, alphabetical so the order does not shift after an edit) and the
 * contact's Manual outreach engagement, matched by email.
 */

export type ContactDetail = {
  contact: FounderInvestorContactRecord;
  pager: { index: number; total: number; prevId: string | null; nextId: string | null };
  engagement: ManualRecipientStatus | null;
};

export async function loadContactDetail(
  companyId: string,
  founderId: string,
  contactId: string,
): Promise<ContactDetail | null> {
  const supabase = await createServerSupabaseClient();

  const { data: row } = await supabase
    .from("founder_investor_contacts")
    .select("*")
    .eq("id", contactId)
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .neq("status", "archived")
    .maybeSingle();
  if (!row) return null;
  const contact = row as unknown as FounderInvestorContactRecord;

  const { data: idRows } = await supabase
    .from("founder_investor_contacts")
    .select("id")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("investor_name", { ascending: true });
  const ids = ((idRows ?? []) as unknown as { id: string }[]).map((r) => r.id);
  const at = Math.max(0, ids.indexOf(contact.id));

  let engagement: ManualRecipientStatus | null = null;
  if (contact.email) {
    try {
      const wanted = contact.email.trim().toLowerCase();
      const recipients = await getManualRecipients(companyId);
      engagement = recipients.find((r) => r.email.trim().toLowerCase() === wanted) ?? null;
    } catch {
      // Engagement is additive; the contact still opens without it.
    }
  }

  return {
    contact,
    pager: {
      index: at + 1,
      total: Math.max(ids.length, 1),
      prevId: at > 0 ? ids[at - 1] : null,
      nextId: at < ids.length - 1 ? ids[at + 1] : null,
    },
    engagement,
  };
}
