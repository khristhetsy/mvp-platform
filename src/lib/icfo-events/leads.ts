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
  answers: Record<string, unknown>;
  createdAt: string;
}

function mapLead(r: Row): EventLead {
  const profile = r.profiles as { full_name?: string | null; email?: string | null } | null;
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    leadType: r.lead_type as EventLead["leadType"],
    company: (r.company as string | null) ?? null,
    status: (r.status as LeadStatus) ?? "open",
    contactName: profile?.full_name ?? null,
    contactEmail: profile?.email ?? null,
    answers: (r.answers as Record<string, unknown>) ?? {},
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
