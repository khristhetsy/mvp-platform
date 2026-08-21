// iCFO Events — sponsor / service-provider lead pipeline. Rows are created at
// registration intake (registration-intake.ts) and worked by staff here.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Row = Record<string, unknown>;
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export const LEAD_STATUSES = ["open", "contacted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface EventLead {
  id: string;
  eventId: string;
  leadType: "service" | "sponsor";
  company: string | null;
  status: LeadStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  answers: Record<string, unknown>;
  createdAt: string;
}

function mapLead(r: Row): EventLead {
  const profile = r.profiles as { full_name?: string | null; email?: string | null } | null;
  const answers = (r.answers as Record<string, unknown>) ?? {};
  // Editable overrides live in answers (name/email/phone) so we never mutate the
  // registrant's user profile; fall back to the linked profile when unset.
  const ov = (k: string) => (typeof answers[k] === "string" && answers[k] ? (answers[k] as string) : null);
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    leadType: r.lead_type as EventLead["leadType"],
    company: (r.company as string | null) ?? null,
    status: (r.status as LeadStatus) ?? "open",
    contactName: ov("name") ?? profile?.full_name ?? null,
    contactEmail: ov("email") ?? profile?.email ?? null,
    contactPhone: ov("phone"),
    answers,
    createdAt: String(r.created_at),
  };
}

/** All leads for an event, newest first (staff). */
export async function listEventLeads(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventLead[]> {
  const { data, error } = await raw(supabase)
    .from("event_leads")
    .select("*, profiles:profile_id(full_name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapLead);
}

/** Move a lead along the pipeline (staff). */
export async function setLeadStatus(
  supabase: SupabaseClient<Database>,
  leadId: string,
  status: LeadStatus,
): Promise<EventLead> {
  const { data, error } = await raw(supabase)
    .from("event_leads")
    .update({ status })
    .eq("id", leadId)
    .select("*, profiles:profile_id(full_name, email)")
    .single();
  if (error) throw new Error(error.message);
  return mapLead(data as Row);
}

/** Edit a lead's contact details (name/email/phone) — stored as overrides in
 *  answers so the registrant's user profile is never modified (staff). */
export async function setLeadContact(
  supabase: SupabaseClient<Database>,
  leadId: string,
  patch: { contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null },
): Promise<EventLead> {
  const { data: cur, error: readErr } = await raw(supabase)
    .from("event_leads")
    .select("answers")
    .eq("id", leadId)
    .single();
  if (readErr) throw new Error(readErr.message);
  const answers = { ...(((cur as Row)?.answers as Record<string, unknown>) ?? {}) };
  if (patch.contactName !== undefined) answers.name = patch.contactName ?? "";
  if (patch.contactEmail !== undefined) answers.email = patch.contactEmail ?? "";
  if (patch.contactPhone !== undefined) answers.phone = patch.contactPhone ?? "";
  const { data, error } = await raw(supabase)
    .from("event_leads")
    .update({ answers })
    .eq("id", leadId)
    .select("*, profiles:profile_id(full_name, email)")
    .single();
  if (error) throw new Error(error.message);
  return mapLead(data as Row);
}
