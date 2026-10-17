import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

/**
 * Delete one of the founder's contacts for good. Only allowed when no email has
 * gone to the contact: deleting also removes its Manual outreach and outreach
 * message rows, and the email limit counts what was sent. A contact that has
 * been emailed can only be archived.
 */

/**
 * True when any email has been sent to this contact, by Manual outreach or by an
 * outreach campaign. If a check can't be completed it answers true, so a failed
 * lookup never allows a delete.
 */
export async function contactHasSentEmail(companyId: string, contactId: string, email: string | null): Promise<boolean> {
  try {
    const db = serviceRoleClientUntyped();

    const { data: recipients, error: recipientsError } = await db
      .from("founder_manual_outreach_recipients")
      .select("id, last_sent_at")
      .eq("company_id", companyId)
      .eq("contact_id", contactId);
    if (recipientsError) return true;
    const rows = (recipients ?? []) as Array<{ id: string; last_sent_at: string | null }>;
    if (rows.some((r) => r.last_sent_at)) return true;

    if (rows.length > 0) {
      const { count, error } = await db
        .from("manual_outreach_sends")
        .select("*", { count: "exact", head: true })
        .in("recipient_id", rows.map((r) => r.id));
      if (error || (count ?? 0) > 0) return true;
    }

    // The send log also records the address, so a contact whose Manual outreach row was removed still counts.
    const address = email?.trim().toLowerCase();
    if (address) {
      const { count, error } = await db
        .from("manual_outreach_sends")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .ilike("email", address);
      if (error || (count ?? 0) > 0) return true;
    }

    const { count: messages, error: messagesError } = await db
      .from("outreach_messages")
      .select("*", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .or("sent_at.not.is.null,status.in.(sent,replied,bounced)");
    if (messagesError || (messages ?? 0) > 0) return true;

    return false;
  } catch {
    return true;
  }
}

export type DeleteContactResult =
  | { ok: true; name: string }
  | { ok: false; reason: "not_found" | "emails_sent" | "error" };

export async function deleteFounderContact(
  supabase: SupabaseClient<Database>,
  input: { founderId: string; companyId: string; contactId: string },
): Promise<DeleteContactResult> {
  const { data: found } = await supabase
    .from("founder_investor_contacts")
    .select("id, investor_name, email")
    .eq("id", input.contactId)
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .maybeSingle();
  if (!found) return { ok: false, reason: "not_found" };
  const contact = found as unknown as { id: string; investor_name: string; email: string | null };

  if (await contactHasSentEmail(input.companyId, contact.id, contact.email)) return { ok: false, reason: "emails_sent" };

  const { error } = await supabase
    .from("founder_investor_contacts")
    .delete()
    .eq("id", contact.id)
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId);
  if (error) return { ok: false, reason: "error" };
  return { ok: true, name: contact.investor_name };
}
