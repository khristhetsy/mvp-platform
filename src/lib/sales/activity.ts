// Sales activity log — records tracked events and reads a contact's timeline.
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type ActivityKind = "note" | "call" | "email" | "message" | "contact_edit" | "task_created" | "task_done" | "converted" | "stage_changed" | "won" | "lost" | "opp_note" | "email_draft";
export type Activity = { id: string; kind: ActivityKind; summary: string; actor_name: string | null; created_at: string };

export async function logActivity(input: {
  kind: ActivityKind; summary: string; actorId?: string | null;
  contactCrmId?: string | null; opportunityId?: string | null; meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    let contactCrmId = input.contactCrmId ?? null;
    if (!contactCrmId && input.opportunityId) {
      const { data } = await db().from("sales_opportunities").select("contact_crm_id").eq("id", input.opportunityId).maybeSingle();
      contactCrmId = (data?.contact_crm_id as string) ?? null;
    }
    await db().from("sales_activity_log").insert({
      contact_crm_id: contactCrmId, opportunity_id: input.opportunityId ?? null,
      actor_id: input.actorId ?? null, kind: input.kind, summary: input.summary, meta: input.meta ?? null,
    });
  } catch { /* logging must never break the primary action */ }
}

/**
 * Logs an "Email sent" activity for every recipient that matches a CRM contact
 * (by email, case-insensitive) — onto the contact and any of its open
 * opportunities. Called after a real send so any email to a contact shows on
 * their timeline, no matter which screen it was sent from. Best-effort.
 */
export async function logOutboundEmailActivity(
  recipients: string[],
  subject: string,
  actorId?: string | null,
): Promise<void> {
  try {
    const emails = [...new Set(recipients.map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 25);
    if (emails.length === 0) return;
    const summary = `Email sent${subject ? `: ${subject.slice(0, 160)}` : ""}`;
    for (const email of emails) {
      const { data: contact } = await db().from("crm_contacts").select("id").ilike("email", email).maybeSingle();
      const contactId = (contact?.id as string | undefined) ?? null;
      if (!contactId) continue;
      const { data: opps } = await db()
        .from("sales_opportunities")
        .select("id")
        .eq("contact_crm_id", contactId)
        .eq("status", "open");
      const openOpps = (opps ?? []) as Array<{ id: string }>;
      if (openOpps.length > 0) {
        for (const o of openOpps) await logActivity({ kind: "email", summary, actorId, opportunityId: o.id });
      } else {
        await logActivity({ kind: "email", summary, actorId, contactCrmId: contactId });
      }
    }
  } catch { /* never block the send */ }
}

export async function listContactActivity(contactCrmId: string): Promise<Activity[]> {
  const { data } = await db()
    .from("sales_activity_log")
    .select("id, kind, summary, created_at, actor:profiles!sales_activity_log_actor_id_fkey(full_name, email)")
    .eq("contact_crm_id", contactCrmId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const a = r.actor as { full_name?: string | null; email?: string | null } | null;
    return { id: String(r.id), kind: r.kind as ActivityKind, summary: String(r.summary), actor_name: a?.full_name ?? a?.email ?? null, created_at: String(r.created_at) };
  });
}
